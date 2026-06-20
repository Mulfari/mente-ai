import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import AdminPanelClient from "@/components/AdminPanelClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin - VeChat" };

export default async function AdminPage() {
  const { userId } = await auth();
  const supabase = await createClient();

  if (!userId) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center p-8 rounded-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Acceso restringido</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Inicia sesión para acceder al panel de administración</p>
        <a href="/sign-in" className="inline-block px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
          Iniciar sesión
        </a>
      </div>
    </div>
  );

  // Find the admin's profile in our DB
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("clerk_user_id", userId)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") return (
    <div className="min-h-screen flex items-center justify-center">
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

  const internalAdminId = adminProfile.id;

  // Admin ya verificado arriba; el client (service role) ya salta RLS.
  const adminClient = supabase;

  // Fetch profiles (now has email column populated by Clerk webhook)
  const { data: allProfiles } = await adminClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: allCoupons } = await adminClient
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  // profiles already have email from the Clerk webhook (no auth.users lookup needed)
  const profilesWithEmail = (allProfiles || []).map(p => {
    const profile: any = { ...p };
    const startDate = p.subscription_start ? new Date(p.subscription_start) : new Date(p.created_at);
    const now = new Date();
    const daysActive = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    profile.daily_rate = p.messages_used > 0 ? Math.round(p.messages_used / daysActive) : 0;
    return profile;
  });

  return <AdminPanelClient initialProfiles={profilesWithEmail} initialCoupons={allCoupons || []} adminId={internalAdminId} />;
}