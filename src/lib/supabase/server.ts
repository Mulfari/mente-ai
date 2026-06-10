import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client for DB queries.
// Uses service role key — bypasses RLS. Only call from server code (route handlers, server components).
// All user authentication/authorization should be done via Clerk's `auth()` helper BEFORE calling this.
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
