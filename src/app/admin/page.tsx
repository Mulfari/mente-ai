import { createClient } from "@/lib/supabase/server";
import AdminPanelClient from "@/components/AdminPanelClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin - Mulfai" };

type Props = {
  initialProfiles?: any[];
  initialCoupons?: any[];
  initialPlaces?: any[];
  initialCategories?: any[];
  initialCities?: any[];
  initialKnowledgeRules?: any[];
  fetchError?: string;
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
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

  // Handle server-side admin actions
  const params = await searchParams;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

  if (serviceKey && supabaseUrl && params.action) {
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };
    if (params.action === "delete-coupon" && params.id) {
      await fetch(`${supabaseUrl}/rest/v1/coupons?id=eq.${params.id}`, {
        method: "DELETE",
        headers,
      });
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

  let profiles: any[] = [];
  let coupons: any[] = [];
  let places: any[] = [];
  let categories: any[] = [];
  let cities: any[] = [];
  let knowledgeRules: any[] = [];
  let fetchError = "";

  if (!serviceKey || !supabaseUrl) {
    console.error("[AdminPage] Missing env vars:", { hasServiceKey: !!serviceKey, hasUrl: !!supabaseUrl });
  } else {
    try {
      const headers = {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      };
      const [pRes, cRes, placesRes, catsRes, citiesRes, rulesRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/coupons?select=*&order=created_at.desc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/places?select=*,cities(name,slug),categories(name,slug,icon,color)&active=eq.true&order=rating.desc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/categories?select=*&active=eq.true&order=sort_order.asc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/cities?select=*&active=eq.true&order=name.asc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/knowledge_rules?select=*&active=eq.true&order=priority.desc`, { headers }),
      ]);
      if (!pRes.ok) { fetchError += `profiles: ${pRes.status} `; } else { profiles = await pRes.json(); }
      if (!cRes.ok) { fetchError += `coupons: ${cRes.status} `; } else { coupons = await cRes.json(); }
      if (!placesRes.ok) { console.error("[AdminPage] Places failed:", placesRes.status); } else { places = await placesRes.json(); }
      if (!catsRes.ok) { console.error("[AdminPage] Categories failed:", catsRes.status); } else { categories = await catsRes.json(); }
      if (!citiesRes.ok) { console.error("[AdminPage] Cities failed:", citiesRes.status); } else { cities = await citiesRes.json(); }
      if (!rulesRes.ok) { console.error("[AdminPage] Rules failed:", rulesRes.status); } else { knowledgeRules = await rulesRes.json(); }
      // Inject emails from auth.users into profiles
      try {
        const emailRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, { headers });
        if (emailRes.ok) {
          const usersData: any = await emailRes.json();
          const emailMap: Record<string, string> = {};
          if (Array.isArray(usersData.users)) {
            for (const u of usersData.users) emailMap[u.id] = u.email;
          }
          for (const p of profiles) (p as any).email = emailMap[p.id] || null;
        }
      } catch {}
    } catch (e: any) { console.error("[AdminPage] Catch error:", e.message); fetchError = e.message; }
  }

  return <AdminPanelClient
    initialProfiles={profiles}
    initialCoupons={coupons}
    initialPlaces={places}
    initialCategories={categories}
    initialCities={cities}
    initialKnowledgeRules={knowledgeRules}
    fetchError={fetchError}
  />;
}