import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client autenticado con Clerk (third-party auth).
// Cada request lleva el session token de Clerk como Bearer; Supabase lo
// valida contra el JWKS de la instancia (configurado en Authentication →
// Third-Party Auth) y las policies de RLS resuelven el perfil interno vía
// auth.jwt()->>'sub' (clerk_user_id). Sin sesión → anon → RLS bloquea todo.

type ClerkGlobal = {
  loaded?: boolean;
  session?: { getToken(opts?: { template?: string }): Promise<string | null> } | null;
};

// clerk-js lo inyecta ClerkProvider de forma asíncrona; las primeras queries
// del chat pueden disparar antes de que cargue. Esperamos (máx 10s) a que
// esté listo para no mandar requests anónimas que RLS devolvería vacías.
async function clerkAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Clerk?: ClerkGlobal };
  const start = Date.now();
  while (!w.Clerk?.loaded && Date.now() - start < 10_000) {
    await new Promise((r) => setTimeout(r, 50));
  }
  try {
    // Template "supabase" (creado vía Clerk API): añade {"role":"authenticated"},
    // requisito de Supabase third-party auth. clerk-js lo cachea ~60s.
    return (await w.Clerk?.session?.getToken({ template: "supabase" })) ?? null;
  } catch {
    return null;
  }
}

let client: SupabaseClient | null = null;

export function createClient() {
  if (client) return client;
  client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { accessToken: clerkAccessToken }
  );
  return client;
}
