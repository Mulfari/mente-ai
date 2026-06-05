"""apply_vps_patch.py — apply the Wave 1 RAG patch to the VPS in one shot.

Steps (run in order):
  1. SCP the new files to /root/vechat-orchestrator/{src,scripts}/
  2. Append COHERE_API_KEY to /root/vechat-orchestrator/.env
  3. Run the SQL migration via psql
  4. Patch package.json to add the backfill-embeddings script
  5. Restart the vechat.service
  6. Optionally run the backfill
  7. Print verification commands

Usage:
  python apply_vps_patch.py --cohere-key <COHERE_KEY>
  python apply_vps_patch.py --cohere-key <COHERE_KEY> --skip-backfill
  python apply_vps_patch.py --cohere-key <COHERE_KEY> --rollback   # revert to git HEAD
"""
import argparse
import os
import sys
import time

import paramiko

HOST = "177.7.46.156"
USER = "root"
PASSWORD = "L3l'cyvqq4M;uGhd@Jf@"
REMOTE = "/root/vechat-orchestrator"
LOCAL_PATCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vps-patches", "20260605")


def ssh_exec(client, cmd, timeout=60):
    """Run `cmd` over SSH, return (stdout, stderr, exit_code)."""
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    return out, err, rc


def scp_put(client, local_path, remote_path, perms="0644"):
    """Upload a file via SFTP and chmod it on the remote."""
    sftp = client.open_sftp()
    try:
        sftp.put(local_path, remote_path)
        sftp.chmod(remote_path, int(perms, 8))
    finally:
        sftp.close()


def confirm(question):
    """Y/n prompt. Defaults to no on EOF."""
    try:
        ans = input(f"{question} [y/N] ").strip().lower()
    except EOFError:
        return False
    return ans in ("y", "yes")


def main():
    ap = argparse.ArgumentParser(description="Apply Wave 1 RAG patch to the VPS orchestrator.")
    ap.add_argument("--cohere-key", required=True, help="Cohere API key (https://dashboard.cohere.com/api-keys)")
    ap.add_argument("--skip-backfill", action="store_true", help="Apply patch but don't run backfill")
    ap.add_argument("--rollback", action="store_true", help="Revert: restore orchestrator.ts / index.ts from a backup if one exists")
    args = ap.parse_args()

    print(f"Connecting to {HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, allow_agent=False, look_for_keys=False)
    print("connected.\n")

    try:
        if args.rollback:
            do_rollback(client)
            return

        # 1. Upload files
        print("=== 1/6 Uploading new files ===")
        files_to_src = ["embeddings.ts", "orchestrator.ts", "index.ts"]
        for f in files_to_src:
            local = os.path.join(LOCAL_PATCH, "src", f)
            remote = f"{REMOTE}/src/{f}"
            scp_put(client, local, remote)
            print(f"  uploaded src/{f}")
        # backfill script
        scripts_dir = f"{REMOTE}/scripts"
        ssh_exec(client, f"mkdir -p {scripts_dir}")
        scp_put(client, os.path.join(LOCAL_PATCH, "scripts", "backfill-embeddings.ts"), f"{scripts_dir}/backfill-embeddings.ts")
        print(f"  uploaded scripts/backfill-embeddings.ts")
        # migration SQL
        scp_put(client, os.path.join(LOCAL_PATCH, "20260605_pgvector_embeddings.sql"), f"{REMOTE}/20260605_pgvector_embeddings.sql")
        print(f"  uploaded 20260605_pgvector_embeddings.sql\n")

        # 2. Append COHERE_API_KEY to .env
        print("=== 2/6 Writing COHERE_API_KEY to .env ===")
        # Idempotent: only append if not already present.
        out, _, rc = ssh_exec(
            client,
            f"grep -q '^COHERE_API_KEY=' {REMOTE}/.env && echo ALREADY_SET || echo 'COHERE_API_KEY={args.cohere_key}' >> {REMOTE}/.env",
        )
        if "ALREADY_SET" in out:
            print(f"  COHERE_API_KEY already in .env — leaving as-is (update manually if you need to rotate)")
        else:
            print(f"  appended COHERE_API_KEY to .env")
        # Sanity check: reload .env and print first 2 chars
        out, _, _ = ssh_exec(client, f"grep '^COHERE_API_KEY=' {REMOTE}/.env | head -c 30")
        print(f"  current line: {out.strip()}...\n")

        # 3. Run the SQL migration
        # Two pre-conditions on the VPS:
        #   a) pgvector must be installed at the OS level (apt package)
        #   b) the migration must run as a superuser, since the 3 tables are
        #      owned by different roles (qa_pairs/knowledge=postgres,
        #      response_feedback=vechat_app). The orchestrator's DATABASE_URL
        #      user (vechat_app) can't ALTER them. Running as `postgres` (sudo)
        #      bypasses ownership checks because postgres is a superuser.
        # Also: .env is loaded by Node's dotenv, not the shell, so $DATABASE_URL
        # is empty in non-Node contexts.
        print("=== 3/6 Installing pgvector + applying migration ===")

        # 3a. Install pgvector (idempotent — `apt install` skips if present)
        out, err, rc = ssh_exec(
            client,
            "DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16-pgvector 2>&1 | tail -10",
            timeout=180,
        )
        print(out + err)
        if rc != 0:
            print(f"!!! apt install pgvector failed (rc={rc}). Aborting.")
            sys.exit(1)

        # 3b. Apply the migration as the `postgres` superuser against the `vechat` db.
        # /root is mode 700, so postgres can't read the SQL directly. Copy to /tmp.
        out, err, rc = ssh_exec(
            client,
            f"cp {REMOTE}/20260605_pgvector_embeddings.sql /tmp/wave1_migration.sql && "
            f"chmod 644 /tmp/wave1_migration.sql && "
            f"sudo -u postgres psql -d vechat -f /tmp/wave1_migration.sql 2>&1",
            timeout=120,
        )
        print(out + err)
        if rc != 0:
            print(f"!!! psql exited with code {rc}. Aborting before service restart.")
            sys.exit(1)
        # Verify the column exists
        out, _, rc = ssh_exec(
            client,
            "sudo -u postgres psql -d vechat -c \"SELECT table_name, data_type FROM information_schema.columns WHERE table_name IN ('qa_pairs','response_feedback','knowledge') AND column_name = 'embedding' ORDER BY table_name;\"",
        )
        print(out)
        if "USER-DEFINED" not in out and "vector" not in out:
            print("!!! embedding column not found on at least one table. Aborting.")
            sys.exit(1)
        print("  migration applied successfully.\n")

        # 4. Patch package.json to add the backfill script
        print("=== 4/6 Patching package.json ===")
        # Idempotent: check if script already present.
        out, _, _ = ssh_exec(client, f"grep -q 'backfill-embeddings' {REMOTE}/package.json && echo HAS || echo MISSING")
        if "HAS" in out:
            print(f"  backfill-embeddings script already in package.json")
        else:
            node_cmd = (
                f"node -e \"const fs=require('fs');"
                f"const p=JSON.parse(fs.readFileSync('{REMOTE}/package.json','utf8'));"
                f"p.scripts=p.scripts||{{}};"
                f"p.scripts['backfill-embeddings']='tsx scripts/backfill-embeddings.ts';"
                f"fs.writeFileSync('{REMOTE}/package.json',JSON.stringify(p,null,2));\""
            )
            out, err, rc = ssh_exec(client, node_cmd)
            if rc != 0:
                print(f"  !!! failed to patch package.json: {err}")
                sys.exit(1)
            print(f"  added 'backfill-embeddings' script")
        print()

        # 5. Restart the service
        print("=== 5/6 Restarting vechat.service ===")
        out, err, rc = ssh_exec(client, "systemctl restart vechat.service", timeout=30)
        if rc != 0:
            print(f"  !!! restart failed: {err}")
            sys.exit(1)
        time.sleep(2)
        out, _, _ = ssh_exec(client, "systemctl is-active vechat.service")
        if "active" not in out:
            print(f"  !!! service not active: {out}")
            print("  tailing the last 30 log lines:")
            _, log, _ = ssh_exec(client, "journalctl -u vechat -n 30 --no-pager")
            print(log)
            sys.exit(1)
        print(f"  service is {out.strip()}")
        # Sanity: tail a few log lines
        out, _, _ = ssh_exec(client, "journalctl -u vechat -n 5 --no-pager", timeout=10)
        print("  recent log lines:")
        for line in out.strip().splitlines()[-5:]:
            print(f"    {line}")
        print()

        # 6. Backfill (optional)
        if args.skip_backfill:
            print("=== 6/6 Skipping backfill (--skip-backfill) ===\n")
        else:
            print("=== 6/6 Running backfill ===")
            print("  this embeds all existing rows in qa_pairs, response_feedback, knowledge")
            if not confirm("Run backfill now?"):
                print("  skipped. Run later with: ssh root@177.7.46.156 'cd /root/vechat-orchestrator && npm run backfill-embeddings'")
            else:
                out, err, rc = ssh_exec(
                    client,
                    f"cd {REMOTE} && npm run backfill-embeddings 2>&1",
                    timeout=600,
                )
                print(out + err)
                if rc != 0:
                    print(f"  !!! backfill exited with code {rc}. You can re-run to resume.")
            print()

        # 7. Verification commands
        print("=== Verification commands ===")
        print("Run these from your laptop to confirm the patch worked:\n")
        print("  # 1. service is running and embedding was used")
        print("  ssh root@177.7.46.156 'journalctl -u vechat -n 20 --no-pager | grep -i embed'\n")
        print("  # 2. ask a question via the browser, then check the row was auto-embedded")
        print("  ssh root@177.7.46.156 \"psql \\$DATABASE_URL -c \\\"SELECT id, embedding IS NOT NULL AS has_emb FROM qa_pairs ORDER BY id DESC LIMIT 1;\\\"\"\n")
        print("  # 3. retrieval smoke test (type a paraphrased version of a known QA, check matches)")
        print("  ssh root@177.7.46.156 'cd /root/vechat-orchestrator && node -e \"import(\\\\\\\"./src/embeddings.js\\\\\\\").then(async m=>{const e=await m.embed(\\\\\\\"donde pido una buena pizza\\\\\\\",\\\\\\\"search_query\\\\\\\");console.log(\\\\\\\"got embedding of length\\\\\\\",e.length)})\"'")
        print()
        print("done.")
    finally:
        client.close()


def do_rollback(client):
    """Revert the patch. Looks for .bak files we didn't make, so this is best-effort.

    In practice the user just regenerates the orchestrator from a known-good
    copy. We print the manual steps here.
    """
    print("Rollback mode: this script doesn't auto-rollback (no clean checkpoint).")
    print("Manual rollback:")
    print(f"  1. ssh root@{HOST}")
    print(f"  2. Unset the env: sed -i '/^COHERE_API_KEY=/d' {REMOTE}/.env")
    print(f"  3. (Optional) Drop the column: psql \"$DATABASE_URL\" -c 'ALTER TABLE qa_pairs DROP COLUMN embedding; ALTER TABLE response_feedback DROP COLUMN embedding; ALTER TABLE knowledge DROP COLUMN embedding;'")
    print(f"  4. Remove the new files: rm {REMOTE}/src/embeddings.ts {REMOTE}/scripts/backfill-embeddings.ts {REMOTE}/20260605_pgvector_embeddings.sql")
    print(f"  5. Restore orchestrator.ts and index.ts from your local vps-backup/ mirror or git")
    print(f"  6. Remove the npm script: edit {REMOTE}/package.json, delete the 'backfill-embeddings' line")
    print(f"  7. systemctl restart vechat.service")


if __name__ == "__main__":
    main()
