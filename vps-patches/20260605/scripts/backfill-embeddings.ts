// Wave 1: one-time backfill. Iterates qa_pairs, response_feedback, knowledge
// where embedding IS NULL, embeds the text in batches of 96 (Cohere max),
// and writes the vectors back. Idempotent and resumable — re-running
// skips rows that already have an embedding.
//
// Usage (on the VPS):
//   cd /root/vechat-orchestrator
//   npx tsx scripts/backfill-embeddings.ts
//
// Reads DATABASE_URL and COHERE_API_KEY from the orchestrator's .env
// (via dotenv, same pattern as orchestrator.ts).

import { Pool } from "pg";
import dotenv from "dotenv";
import { embedBatch, EmbedError } from "../src/embeddings";

dotenv.config();

const BATCH = 96;

type TableSpec = {
  name: string;
  // SQL expression that produces the text we embed, given a row.
  textExpr: string;
};

const TABLES: TableSpec[] = [
  { name: "qa_pairs",          textExpr: "question" },
  { name: "response_feedback", textExpr: "question" },
  { name: "knowledge",         textExpr: "COALESCE(title, '') || ' ' || COALESCE(content, '')" },
];

function toPgVector(v: number[]): string {
  return JSON.stringify(v);
}

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  if (!process.env.COHERE_API_KEY) throw new Error("COHERE_API_KEY not set");

  const pool = new Pool({ connectionString: dbUrl });

  for (const table of TABLES) {
    const totalRes = await pool.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM ${table.name}`
    );
    const total = parseInt(totalRes.rows[0]?.count ?? "0", 10);
    if (total === 0) {
      console.log(`[${table.name}] 0 rows, skipping`);
      continue;
    }
    console.log(`[${table.name}] ${total} rows total`);

    let done = 0;
    let consecutiveEmpty = 0;
    const start = Date.now();

    while (true) {
      const rowsRes = await pool.query<{ id: number; text: string }>(
        `SELECT id, ${table.textExpr} AS text
           FROM ${table.name}
          WHERE embedding IS NULL
          ORDER BY id
          LIMIT $1`,
        [BATCH]
      );
      const rows = rowsRes.rows;
      if (rows.length === 0) break;

      // Filter out empty/whitespace-only texts — those would be sent to
      // Cohere and rejected, and we don't want to retry the same row
      // forever. Embed with zeros so the row still has *something*, and
      // it can be skipped by the vector retriever (cosine distance to a
      // zero vector is undefined; pgvector returns 0, which is fine).
      const texts = rows.map((r) => (r.text ?? "").trim());
      const validMask = texts.map((t) => t.length > 0);
      const validTexts = texts.filter((_, i) => validMask[i]);

      let vectors: number[][];
      try {
        vectors = validTexts.length > 0
          ? await embedBatch(validTexts, "search_document")
          : [];
      } catch (e) {
        if (e instanceof EmbedError) {
          console.error(`[${table.name}] Cohere error after ${done}/${total}: ${e.message}`);
        } else {
          console.error(`[${table.name}] Unexpected error after ${done}/${total}:`, e);
        }
        console.error(`[${table.name}] Aborting. Re-run to resume — already-embedded rows are skipped.`);
        await pool.end();
        process.exit(1);
      }

      // Write back each row. Valid texts get real vectors; empties get
      // zero vectors (so we don't re-pick them next loop, but the retriever
      // can still ignore them via the cosine-distance semantics).
      let vecIdx = 0;
      for (let i = 0; i < rows.length; i++) {
        const v = validMask[i] ? vectors[vecIdx++] : new Array(1024).fill(0);
        try {
          await pool.query(
            `UPDATE ${table.name} SET embedding = $1::vector WHERE id = $2`,
            [toPgVector(v), rows[i].id]
          );
        } catch (err) {
          // Don't fail the whole batch on a single row write — log and continue.
          console.warn(`[${table.name}] failed to write embedding for id ${rows[i].id}:`, (err as Error).message);
        }
      }

      done += rows.length;
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const pct = total > 0 ? ((done / total) * 100).toFixed(1) : "0.0";
      console.log(`[${table.name}] ${done}/${total} (${pct}%) embedded — ${elapsed}s elapsed`);

      if (rows.length < BATCH) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 2) break;
      } else {
        consecutiveEmpty = 0;
      }
    }

    const totalSec = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[${table.name}] done in ${totalSec}s — ${done}/${total} rows embedded`);
  }

  await pool.end();
  console.log("\nbackfill complete");
}

run().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});
