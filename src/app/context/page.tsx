import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContextEditor from "@/components/ContextEditor";

export default async function ContextPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <ContextEditor />;
}
