import { createClient } from "@/lib/supabase/server";
import AdminPanelClient from "@/components/AdminPanelClient";
import { createClient as createSupabase } from "@supabase/supabase-js";

function createServiceClient() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;

  // Fetch admin data server-side using service role key (bypasses RLS)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  let profiles: any[] = [];
  let coupons: any[] = [];

  if (serviceKey && supabaseUrl) {
    try {
      const headers = {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      };
      const [pRes, cRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/coupons?select=*&order=created_at.desc`, { headers }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); profiles = d; }
      if (cRes.ok) { const d = await cRes.json(); coupons = d; }
    } catch (e) { console.error("Admin data fetch error:", e); }
  }

  return <AdminPanelClient initialProfiles={profiles} initialCoupons={coupons} />;
}