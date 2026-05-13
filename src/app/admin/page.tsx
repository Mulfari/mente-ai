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

  return <AdminPanelClient />;
}