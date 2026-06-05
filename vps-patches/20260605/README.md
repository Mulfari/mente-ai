# Wave 1 — RAG on VPS Postgres (pgvector + Cohere multilingual)

Runbook for the user. Patches the VPS orchestrator to do semantic retrieval
(via pgvector + Cohere `embed-multilingual-v3`) instead of trigram/ILIKE.

## What this changes

| File | What | Why |
|---|---|---|
| `src/embeddings.ts` | **new** | Cohere wrapper with LRU cache, 5s timeout, typed errors |
| `src/orchestrator.ts` | rewrite | 3 retrievers → vector-first with trigram fallback; 3 save functions auto-embed |
| `src/index.ts` | patch | embed the question once, pass to all 3 retrievers |
| `scripts/backfill-embeddings.ts` | **new** | one-time backfill of all existing rows |
| `20260605_pgvector_embeddings.sql` | **new** | adds `vector(1024)` columns + HNSW indexes |
| `package.json` | patch | adds `npm run backfill-embeddings` script |

**Nothing in mente-ai (Vercel) is touched.** The orchestrator is the only
consumer of the RAG plumbing in the hot path.

Local layout in this directory mirrors the deployed layout on the VPS:

```
vps-patches/20260605/
├── README.md
├── 20260605_pgvector_embeddings.sql     → uploaded to /root/vechat-orchestrator/
├── src/
│   ├── embeddings.ts                    → uploaded to /root/vechat-orchestrator/src/
│   ├── orchestrator.ts                  → uploaded to /root/vechat-orchestrator/src/
│   └── index.ts                         → uploaded to /root/vechat-orchestrator/src/
└── scripts/
    └── backfill-embeddings.ts           → uploaded to /root/vechat-orchestrator/scripts/
```

## Run order (do these in sequence)

### 0. Get a Cohere API key

Go to https://dashboard.cohere.com/api-keys, create a key. Free tier is
plenty (3k embeddings/month, we use <500).

### 1. Add the key to the VPS env

```bash
ssh root@177.7.46.156
echo 'COHERE_API_KEY=your_key_here' >> /root/vechat-orchestrator/.env
exit
```

### 2. Apply the SQL migration

From your local mente-ai dir:

```bash
scp vps-patches/20260605/20260605_pgvector_embeddings.sql root@177.7.46.156:/root/vechat-orchestrator/
ssh root@177.7.46.156
cd /root/vechat-orchestrator
psql "$DATABASE_URL" -f 20260605_pgvector_embeddings.sql
psql "$DATABASE_URL" -c "\d qa_pairs"  # confirm `embedding | vector(1024)` shows up
exit
```

Or use the `apply_vps_patch.py` script (in the mente-ai root) which does
all of this in one go. **But first read step 3 below — you need to upload
the new code BEFORE running the migration so the app actually uses it.**

### 3. Upload the new code

```bash
scp vps-patches/20260605/src/embeddings.ts vps-patches/20260605/src/orchestrator.ts vps-patches/20260605/src/index.ts \
    root@177.7.46.156:/root/vechat-orchestrator/src/
scp vps-patches/20260605/scripts/backfill-embeddings.ts \
    root@177.7.46.156:/root/vechat-orchestrator/scripts/
```

### 4. Add the npm script

SSH in and edit `/root/vechat-orchestrator/package.json`. Add to `"scripts"`:

```json
"backfill-embeddings": "tsx scripts/backfill-embeddings.ts"
```

Or patch it with sed:

```bash
ssh root@177.7.46.156
cd /root/vechat-orchestrator
# backup
cp package.json package.json.bak
# add the script (assumes a `"scripts":` block exists with at least one entry)
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.scripts=p.scripts||{};p.scripts['backfill-embeddings']='tsx scripts/backfill-embeddings.ts';fs.writeFileSync('package.json',JSON.stringify(p,null,2));"
cat package.json | grep -A2 scripts
exit
```

### 5. Run the backfill

```bash
ssh root@177.7.46.156
cd /root/vechat-orchestrator
npm run backfill-embeddings
```

Watch the log. Each table prints progress every 96 rows. With ~1k QA pairs
and ~50 knowledge rules this should finish in under 2 minutes.

Verify with:

```bash
psql "$DATABASE_URL" -c "SELECT 'qa_pairs' AS t, count(*) FILTER (WHERE embedding IS NOT NULL) AS embedded, count(*) AS total FROM qa_pairs
                        UNION ALL SELECT 'response_feedback', count(*) FILTER (WHERE embedding IS NOT NULL), count(*) FROM response_feedback
                        UNION ALL SELECT 'knowledge', count(*) FILTER (WHERE embedding IS NOT NULL), count(*) FROM knowledge;"
```

All three rows should show `embedded = total`.

### 6. Restart the service

```bash
ssh root@177.7.46.156
systemctl restart vechat.service
systemctl status vechat.service
journalctl -u vechat -n 30 -f  # tail the log
```

Look for `[VeChat] Orchestrator running on port 3000`. If you see
embedding errors there, the Cohere key is wrong or the API is unreachable
from the VPS — check `curl -I https://api.cohere.ai/v1/embed` from the VPS.

## Verifying it works

1. **Hit the chat from the browser** (`https://www.mulfai.com.ve/chat`).
   Ask something close to a knowledge rule you have, e.g.:
   > "Qué temperatura hace en Maracay"

   Tail the log on the VPS:
   ```bash
   journalctl -u vechat -f | grep -i "embed\|prompt"
   ```
   You should see the embed call succeed and the prompt be larger than
   before (the retrieved knowledge/QA is now actually relevant).

2. **Check that the new rows are auto-embedded.** Send a message, then:
   ```sql
   SELECT id, question, embedding IS NOT NULL AS has_embedding
     FROM qa_pairs ORDER BY id DESC LIMIT 1;
   ```
   `has_embedding` should be `t`.

3. **Test the fallback.** From the VPS:
   ```bash
   iptables -A OUTPUT -d api.cohere.ai -j DROP
   ```
   Send another message. The response should still work (uses trigram
   fallback), and the log should show:
   ```
   [stream] embedding failed, falling back to trigram/ILIKE: cohere: timeout after 5000ms
   ```
   Remove the rule when done:
   ```bash
   iptables -D OUTPUT -d api.cohere.ai -j DROP
   ```

## Rollback

If something goes wrong, the trigram path is still there (it's the
fallback). To fully revert to keyword-only:

```bash
ssh root@177.7.46.156
cd /root/vechat-orchestrator
cp src/orchestrator.ts.bak src/orchestrator.ts  # if you made a backup
cp src/index.ts.bak src/index.ts
systemctl restart vechat.service
```

Or, more surgically, just unset `COHERE_API_KEY` in `.env` and restart —
the embed call will throw and all retrievers will use the fallback path.

## Cost sanity check

Cohere `embed-multilingual-v3` is $0.10 per 1M tokens.

- Backfill: ~1k QA + ~50 knowledge = ~500k tokens ≈ **5 cents**
- Auto-embed on insert: ~$0.01/day at current volume
- Search-time embed (one per request): ~$0.001/day

**Total: <$0.01/day at our scale.** Essentially free.

## What's not in Wave 1

- **Supabase `knowledge_rules`** — different table, different schema.
  The admin UI's knowledge editor doesn't touch the VPS `knowledge` table.
  Future plan.
- **Local-business corpus** (pizzerías, plomería, etc.) — that's Wave 2.
- **City-aware retrieval** — embeddings don't have city metadata. We can
  add a `city` filter later if needed (the `qa_pairs` and `knowledge`
  tables already have city/category columns).
