-- Los enlaces compartidos caducan solos a las 24h (no hay "dejar de compartir"
-- manual). La correctitud la imponen los chequeos expires_at > now() en GET y
-- en la página pública /c/[token]; el barrido del cron (feed-digest) solo
-- limpia las filas ya vencidas.
ALTER TABLE shared_conversations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL
  DEFAULT (now() + interval '24 hours');

-- Filas existentes (si las hubiera): 24h desde su creación.
UPDATE shared_conversations SET expires_at = created_at + interval '24 hours'
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shared_conv_expires ON shared_conversations (expires_at);
