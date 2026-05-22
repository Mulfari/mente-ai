import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import AdminPanelClient from "@/components/AdminPanelClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin - VeChat" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <div className="text-center p-8 rounded-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Acceso restringido</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Inicia sesión para acceder al panel de administración</p>
        <form action="/auth/login" method="POST">
          <button type="submit" className="px-6 py-3 rounded-xl font-semibold text-sm"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <div className="text-center p-8 rounded-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(239,68,68,0.1)" }}>
          <svg className="w-8 h-8" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Sin permisos</h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Tu cuenta no tiene acceso de administrador</p>
        <a href="/" className="text-sm font-medium" style={{ color: "var(--primary)" }}>← Volver al inicio</a>
      </div>
    </div>
  );

  // Use service role client to bypass RLS — admin already gatekept above
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminClient = serviceKey && supabaseUrl
    ? createServiceClient(supabaseUrl, serviceKey)
    : supabase;

  // Fetch profiles + join email from auth.users
  const { data: allProfiles } = await adminClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Attach email from profiles.email column (fallback if auth API fails)
  const profilesWithEmail = (allProfiles || []).map(p => ({ ...p }));

  // Try to enrich with emails from Admin Auth API (service role required)
  if (serviceKey && supabaseUrl) {
    try {
      const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        const emailMap: Record<string, string> = {};
        for (const u of authData.users || []) {
          emailMap[u.id] = u.email;
        }
        for (const p of profilesWithEmail) {
          if (emailMap[p.id]) p.email = emailMap[p.id];
        }
      }
    } catch {
      // Auth API unavailable — use profile emails only
    }
  }

  const params = await searchParams;
  const headers = {
    apikey: serviceKey!,
    Authorization: `Bearer ${serviceKey}`,
  };

  if (serviceKey && supabaseUrl && params.action) {
    if (params.action === "delete-coupon" && params.id) {
      await fetch(`${supabaseUrl}/rest/v1/coupons?id=eq.${params.id}`, { method: "DELETE", headers });
    }
    if (params.action === "generate-coupons" && params.codes && params.config) {
      const codes = JSON.parse(params.codes);
      const config = JSON.parse(params.config);
      const inserts = codes.map((c: string) => ({ code: c, created_by: user.id, ...config }));
      await fetch(`${supabaseUrl}/rest/v1/coupons`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(inserts),
      });
    }
    if (params.action === "update-profile" && params.userId) {
      const updates = JSON.parse(params.updates || "{}");
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${params.userId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(updates),
      });
    }
    redirect("/admin");
  }

  return <AdminPanelClient initialProfiles={profilesWithEmail} />;
}