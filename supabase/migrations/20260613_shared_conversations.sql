-- Conversaciones compartidas por enlace público (modelo "foto fija": al
-- compartir se congela una copia de solo lectura; volver a compartir
-- re-snapshotea manteniendo el mismo token; desactivar borra la fila).
--
-- El enlace público es mulfai.com.ve/c/<token> — token corto aleatorio,
-- NO el UUID de la conversación (no adivinable). Una conversación tiene a lo
-- sumo UN enlace activo (unique conversation_id).
--
-- RLS ON sin policies: solo las rutas API (service role) acceden; la página
-- pública /c/[token] lee con service role por token.

CREATE TABLE IF NOT EXISTS shared_conversations (
  token           text PRIMARY KEY,
  conversation_id uuid NOT NULL,
  owner_id        uuid NOT NULL,           -- profiles.id interno (no se muestra)
  title           text NOT NULL,
  messages        jsonb NOT NULL,          -- [{ role, content }] congelado
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_conv_conversation
  ON shared_conversations (conversation_id);

ALTER TABLE shared_conversations ENABLE ROW LEVEL SECURITY;
