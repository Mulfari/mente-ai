-- Wave 1: pgvector embeddings for qa_pairs, response_feedback, knowledge
-- Run once on the VPS local Postgres (db=vechat):
--   psql "$DATABASE_URL" -f 20260605_pgvector_embeddings.sql
--
-- After this:
--   * pgvector extension is enabled
--   * `embedding vector(1024)` column added to each table
--   * HNSW index on each (cosine distance)
--
-- The column is nullable: rows inserted between this migration and the
-- backfill have NULL embeddings. The new retriever SQL uses
-- `embedding IS NOT NULL` so it gracefully skips them; the existing
-- pg_trgm/ILIKE path picks them up. So no downtime, no NOT NULL trap.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE qa_pairs           ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE response_feedback  ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE knowledge          ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS qa_pairs_embedding_hnsw
  ON qa_pairs USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS response_feedback_embedding_hnsw
  ON response_feedback USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS knowledge_embedding_hnsw
  ON knowledge USING hnsw (embedding vector_cosine_ops);
