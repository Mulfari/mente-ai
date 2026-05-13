import { createClient } from "@/lib/supabase/server";
import AdminPanelClient from "@/components/AdminPanelClient";

export default async function AdminPage() {
  console.log("[AdminPage] Rendering...");
  const supabase = await createClient();
  const { data, error: sessionError } = await supabase.auth.getSession();
  console.log("[AdminPage] session error:", sessionError, "session:", !!data.session);
  const user = data.session?.user;
  console.log("[AdminPage] user:", user?.id, user?.email);

  if (!user) {
    console.log("[AdminPage] No user — returning null");
    return null;
  }

  console.log("[AdminPage] Querying profiles for:", user.id);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  console.log("[AdminPage] profile result:", profile, "error:", profileError);

  if (!profile || profile.role !== "admin") {
    console.log("[AdminPage] Not admin or no profile — returning null");
    return null;
  }

  console.log("[AdminPage] Admin confirmed — rendering panel");

  return <AdminPanelClient />;
}