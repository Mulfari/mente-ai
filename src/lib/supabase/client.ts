import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

// Browser Supabase client — uses anon key + Clerk session via cookies.
// Note: with Clerk as the auth provider, Supabase no longer has a server-side
// session. Queries from the browser go through with the anon key and rely on
// RLS being permissive for authenticated users. All auth gating happens in
// Clerk's middleware before this client is even reached.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          return document.cookie.split(";").reduce<Array<{ name: string; value: string }>>((acc, part) => {
            const [name, ...rest] = part.trim().split("=");
            if (name) acc.push({ name, value: rest.join("=") });
            return acc;
          }, []);
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          cookiesToSet.forEach(({ name, value, options }) => {
            const maxAge = (options as CookieOptions).maxAge ?? 60 * 60 * 24 * 30;
            document.cookie = `${name}=${value}; path=${(options as CookieOptions).path ?? "/"}; max-age=${maxAge}; samesite=${(options as CookieOptions).sameSite ?? "lax"}; secure`;
          });
        },
      },
    }
  );
}
