-- =============================================================================
-- MIGRATION: Supabase Auth -> Clerk
-- Date: 2026-06-09
-- Fresh start: existing user data is archived, not migrated
-- =============================================================================

-- 1. Archive existing user data (in case someone claims their account later)
CREATE TABLE IF NOT EXISTS archived_profiles AS
  SELECT * FROM profiles WHERE 1=0; -- structure only, will populate below

CREATE TABLE IF NOT EXISTS archived_user_context AS
  SELECT * FROM user_context WHERE 1=0;

-- Populate the archives with current data
INSERT INTO archived_profiles
  SELECT * FROM profiles
  ON CONFLICT (id) DO NOTHING;

INSERT INTO archived_user_context
  SELECT * FROM user_context
  ON CONFLICT DO NOTHING;

-- 2. Clean transactional data (chats, messages) — fresh start
TRUNCATE TABLE messages, conversations RESTART IDENTITY CASCADE;

-- 3. Clean user-bound tables
TRUNCATE TABLE user_context, profiles RESTART IDENTITY CASCADE;

-- 4. Update profiles schema to use Clerk user id
-- Drop any old foreign key to auth.users (from Supabase Auth)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 5. Add clerk_user_id column (unique, required)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

-- Backfill: for any existing rows, set a placeholder (shouldn't be any after truncate)
UPDATE profiles
  SET clerk_user_id = 'legacy_' || id::text
  WHERE clerk_user_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE profiles
  ALTER COLUMN clerk_user_id SET NOT NULL;

-- 6. Add index on clerk_user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id ON profiles(clerk_user_id);

-- 7. Drop old profile fields that referenced Supabase Auth internals (if any)
-- These are usually: auth_user_id, email_confirmed_at, etc. We keep just our custom fields.
-- The original schema had: id, email, status, subscription_weeks, weekly_limit, etc.
-- After this migration, we add clerk_user_id and keep everything else.

-- 8. Verify: show the new schema
-- (Run this manually: \d profiles)

-- =============================================================================
-- Notes:
-- - All API routes that used supabase.auth.getUser() must be updated to use Clerk's auth() helper
-- - All foreign keys to profiles.id should still work because id remains a UUID
-- - The clerk_user_id is the new "external" identifier; profiles.id remains the internal PK
-- - Webhook endpoint /api/webhooks/clerk creates profiles on user.created
-- =============================================================================
