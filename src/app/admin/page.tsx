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

  // Fetch admin data server-side via API route (bypasses Vercel Auth for browser)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  let profiles: any[] = [];
  let coupons: any[] = [];

  if (supabaseUrl) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}`;
      const [pRes, cRes] = await Promise.all([
        fetch(`${baseUrl}/api/admin/data?type=profiles`, { cache: "no-store" }),
        fetch(`${baseUrl}/api/admin/data?type=coupons`, { cache: "no-store" }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); profiles = d.data || []; }
      if (cRes.ok) { const d = await cRes.json(); coupons = d.data || []; }
    } catch {}
  }

  return <AdminPanelClient initialProfiles={profiles} initialCoupons={coupons} />;
}