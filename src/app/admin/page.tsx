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

  // Fetch admin data server-side using service role key (bypasses RLS)
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

  let profiles: any[] = [];
  let coupons: any[] = [];
  let fetchError = "";

  if (!serviceKey || !supabaseUrl) {
    console.error("[AdminPage] Missing env vars:", { hasServiceKey: !!serviceKey, hasUrl: !!supabaseUrl });
  } else {
    try {
      const headers = {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      };
      const [pRes, cRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/coupons?select=*&order=created_at.desc`, { headers }),
      ]);
      if (!pRes.ok) {
        const errText = await pRes.text();
        console.error("[AdminPage] Profiles fetch failed:", pRes.status, errText);
        fetchError += `profiles: ${pRes.status} `;
      } else {
        profiles = await pRes.json();
      }
      if (!cRes.ok) {
        const errText = await cRes.text();
        console.error("[AdminPage] Coupons fetch failed:", cRes.status, errText);
        fetchError += `coupons: ${cRes.status} `;
      } else {
        coupons = await cRes.json();
      }
    } catch (e: any) { console.error("[AdminPage] Catch error:", e.message); fetchError = e.message; }
  }

  console.log("[AdminPage] Sending to client:", { profiles: profiles.length, coupons: coupons.length, error: fetchError });

  return <AdminPanelClient initialProfiles={profiles} initialCoupons={coupons} fetchError={fetchError} />;
}