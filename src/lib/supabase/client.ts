import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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