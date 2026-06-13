-- Intereses aprendidos por usuario: fuente de verdad de los chips de
-- "Mi contexto" (manuales + aprendidos de las búsquedas) y de la sección
-- "Para ti" del feed.
--
-- Se alimenta en tiempo real desde /api/track-query (extracción barata de
-- palabras por cada búsqueda) y se refina periódicamente con IA en el cron
-- del feed (junta sinónimos, limpia ruido, pule las etiquetas).
--
-- RLS ON sin policies: solo las rutas API con el service role la tocan
-- (igual que query_events / feed_*). El UI de chips pasa por
-- /api/user-context/interests.

CREATE TABLE IF NOT EXISTS user_interests (
  user_id    uuid        NOT NULL,           -- profiles.id interno
  tag        text        NOT NULL,           -- clave normalizada ("programacion")
  label      text        NOT NULL,           -- etiqueta para mostrar ("Programación")
  weight     real        NOT NULL DEFAULT 1, -- score con decaimiento; se bombea por búsqueda
  source     text        NOT NULL DEFAULT 'learned', -- 'learned' | 'manual'
  pinned     boolean     NOT NULL DEFAULT false,     -- fijado por el usuario; no se poda
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user_weight
  ON user_interests (user_id, weight DESC);

ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- Bombeo de intereses con decaimiento, atómico en una sola llamada.
-- Por cada {tag,label}: weight = weight_viejo * exp(-Δt/14d) + 1. No pisa la
-- etiqueta de chips manuales/fijados. Al final poda los más débiles no fijados
-- (tope ~60 por usuario) para mantener la tabla acotada.
CREATE OR REPLACE FUNCTION bump_user_interests(p_user uuid, p_tags jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_tags)
  LOOP
    INSERT INTO user_interests (user_id, tag, label, weight, source, updated_at)
    VALUES (p_user, item->>'tag', item->>'label', 1, 'learned', now())
    ON CONFLICT (user_id, tag) DO UPDATE SET
      weight = user_interests.weight
        * exp(- extract(epoch FROM (now() - user_interests.updated_at)) / (14 * 86400.0))
        + 1,
      label = CASE WHEN user_interests.source = 'manual' OR user_interests.pinned
                   THEN user_interests.label ELSE excluded.label END,
      updated_at = now();
  END LOOP;

  DELETE FROM user_interests ui
  WHERE ui.user_id = p_user
    AND ui.pinned = false
    AND ui.tag NOT IN (
      SELECT tag FROM user_interests
      WHERE user_id = p_user
      ORDER BY pinned DESC, weight DESC
      LIMIT 60
    );
END;
$$;
