-- Fase 2 del algoritmo del feed: temas canónicos (agrupación con IA) y
-- feed materializado. + Índices pendientes de la fase 1.
--
-- feed_topics: un tema = una pregunta pública limpia ("¿A cuánto está el
--   dólar hoy?") con su categoría. PK = canonical_key (texto normalizado).
-- feed_topic_aliases: mapea el texto normalizado de cada pregunta cruda a
--   su tema canónico ("a como esta el dolar" -> "a cuanto esta el dolar hoy").
-- feed_cache: agregados del feed materializados por el cron (payload jsonb).
--
-- RLS ON sin policies en las tres: solo el service role (rutas API) accede.

CREATE TABLE IF NOT EXISTS feed_topics (
  canonical_key text PRIMARY KEY,
  canonical text NOT NULL,
  category_id text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_topic_aliases (
  key text PRIMARY KEY,
  topic_key text NOT NULL REFERENCES feed_topics(canonical_key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_topic_aliases_topic
  ON feed_topic_aliases (topic_key);

CREATE TABLE IF NOT EXISTS feed_cache (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feed_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_topic_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_cache ENABLE ROW LEVEL SECURITY;

-- Índices pendientes de la fase 1 (consultas del feed por ventana y usuario)
CREATE INDEX IF NOT EXISTS idx_query_events_created_at
  ON query_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_events_user_created
  ON query_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
