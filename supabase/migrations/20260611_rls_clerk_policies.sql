-- =============================================================================
-- MIGRATION: RLS real con Clerk third-party auth
-- Requiere: (1) Supabase → Authentication → Third-Party Auth → Clerk
--           (dominio clerk.mulfai.com.ve), (2) session token de Clerk con
--           claim {"role": "authenticated"}, (3) cliente browser que manda el
--           token de Clerk (src/lib/supabase/client.ts con accessToken).
-- NOTA: nunca usar auth.uid() con Clerk — el sub es 'user_xxx' (no uuid) y el
-- cast de auth.uid() explota. Siempre auth.jwt()->>'sub'.
-- =============================================================================

-- Mapea el id de Clerk (sub del JWT) al UUID interno de profiles.
-- SECURITY DEFINER para poder leer profiles aunque la policy del caller no
-- lo permita; STABLE para que el plan lo evalúe una vez por statement.
CREATE OR REPLACE FUNCTION public.clerk_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE clerk_user_id = (SELECT auth.jwt()->>'sub')
$$;

-- profiles: el usuario solo lee su propia fila (updates van por rutas API)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (clerk_user_id = (SELECT auth.jwt()->>'sub'));

-- conversations: CRUD solo sobre las propias
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversations_own ON conversations;
CREATE POLICY conversations_own ON conversations
  FOR ALL TO authenticated
  USING (user_id = public.clerk_profile_id())
  WITH CHECK (user_id = public.clerk_profile_id());

-- messages: CRUD solo dentro de conversaciones propias
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_own ON messages;
CREATE POLICY messages_own ON messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND c.user_id = public.clerk_profile_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND c.user_id = public.clerk_profile_id()
  ));

-- user_context: CRUD solo sobre el propio
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_context_own ON user_context;
CREATE POLICY user_context_own ON user_context
  FOR ALL TO authenticated
  USING (user_id = public.clerk_profile_id())
  WITH CHECK (user_id = public.clerk_profile_id());
