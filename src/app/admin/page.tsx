import { createClient } from "@/lib/supabase/server";
import AdminPanelClient from "@/components/AdminPanelClient";

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

  // Fetch admin data server-side (bypasses Vercel Auth)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const headers = {
    apikey: serviceKey!,
    Authorization: `Bearer ${serviceKey}`,
  };

  let profiles: any[] = [];
  let coupons: any[] = [];

  if (serviceKey && supabaseUrl) {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/coupons?select=*&order=created_at.desc`, { headers }),
      ]);
      if (pRes.ok) profiles = await pRes.json();
      if (cRes.ok) coupons = await cRes.json();
    } catch {}
  }

  return <AdminPanelClient initialProfiles={profiles} initialCoupons={coupons} />;
}