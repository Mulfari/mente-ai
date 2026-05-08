import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) redirect("/chat");
  return <HomePage />;
}

import HomePage from "@/components/HomePage";