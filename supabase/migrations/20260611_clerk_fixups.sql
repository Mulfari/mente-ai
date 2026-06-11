-- =============================================================================
-- MIGRATION: Clerk fixups — repoint user-bound FKs away from auth.users,
-- align RLS with the documented architecture (RLS off, control in API routes),
-- and allow the 'deleted' profile status used by the Clerk webhook.
-- Date: 2026-06-11
-- Idempotent: safe to run more than once.
-- =============================================================================

-- 1. query_events.user_id referenced auth.users (Supabase Auth, now unused).
--    Repoint to profiles(id). Orphaned ids from the old auth system are nulled
--    (the events still feed the trending aggregates without a user).
ALTER TABLE query_events DROP CONSTRAINT IF EXISTS query_events_user_id_fkey;

UPDATE query_events
  SET user_id = NULL
  WHERE user_id IS NOT NULL
    AND user_id NOT IN (SELECT id FROM profiles);

ALTER TABLE query_events
  ADD CONSTRAINT query_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. conversations.user_id: drop the FK to auth.users and repoint to
--    profiles(id) so new-user inserts don't fail against the dead auth table.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;

DELETE FROM conversations
  WHERE user_id IS NOT NULL
    AND user_id NOT IN (SELECT id FROM profiles);

ALTER TABLE conversations
  ADD CONSTRAINT conversations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. user_context.user_id: same treatment.
ALTER TABLE user_context DROP CONSTRAINT IF EXISTS user_context_user_id_fkey;

DELETE FROM user_context
  WHERE user_id IS NOT NULL
    AND user_id NOT IN (SELECT id FROM profiles);

ALTER TABLE user_context
  ADD CONSTRAINT user_context_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. coupons.used_by / coupons.created_by referenced auth.users.
--    created_by was NOT NULL but the original admin auth user is archived,
--    so allow NULL and keep the coupons usable.
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_used_by_fkey;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_created_by_fkey;
ALTER TABLE coupons ALTER COLUMN created_by DROP NOT NULL;

UPDATE coupons SET used_by = NULL
  WHERE used_by IS NOT NULL AND used_by NOT IN (SELECT id FROM profiles);
UPDATE coupons SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM profiles);

ALTER TABLE coupons
  ADD CONSTRAINT coupons_used_by_fkey
  FOREIGN KEY (used_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE coupons
  ADD CONSTRAINT coupons_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 5. knowledge.created_by referenced auth.users; the admin API now inserts
--    the internal profile id.
ALTER TABLE knowledge DROP CONSTRAINT IF EXISTS knowledge_created_by_fkey;

UPDATE knowledge SET created_by = NULL
  WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM profiles);

ALTER TABLE knowledge
  ADD CONSTRAINT knowledge_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 5b. profiles.id used to come from auth.users(id). With Clerk, rows are
--     created by the webhook / getOrCreateProfile without an explicit id,
--     so the PK needs its own default.
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 6. profiles.status: the Clerk webhook soft-deletes with status='deleted',
--    which the old CHECK did not allow.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text, 'active'::text, 'rejected'::text,
    'cancelled'::text, 'inactive'::text, 'deleted'::text
  ]));

-- 7. RLS: every existing policy gates on auth.uid(), which is always NULL now
--    that auth lives in Clerk (no Supabase session). The browser client reads
--    and writes these tables directly with the anon key, so RLS-on +
--    auth.uid() policies block the entire chat. Architecture decision
--    (documented in CLAUDE.md): RLS off, access control in the API routes.
--    Drop the dead policies and disable RLS on the app tables.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'conversations', 'messages', 'user_context', 'coupons', 'knowledge', 'knowledge_gaps')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE profiles      DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages      DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_context  DISABLE ROW LEVEL SECURITY;
ALTER TABLE coupons       DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge     DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_gaps DISABLE ROW LEVEL SECURITY;
