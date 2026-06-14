import { auth } from "@clerk/nextjs/server";
import ChatInterface from "@/components/ChatInterface";
import Landing from "@/components/landing/Landing";
import { getOrCreateProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/appConfig";

// Deslogueado → landing de venta (muestra el producto y empuja a registrarse).
// Logueado → el chat con su historial. El chat ya NO es la home del visitante.
export default async function Home() {
  const [{ userId }, appConfig] = await Promise.all([auth(), getAppConfig()]);

  if (!userId) {
    return <Landing appConfig={appConfig} />;
  }

  const profile = await getOrCreateProfile(userId);
  if (!profile) {
    // DB caída — landing antes que un crash.
    return <Landing appConfig={appConfig} />;
  }

  const supabase = createClient();
  const { data: uc } = await supabase
    .from("user_context")
    .select("full_name")
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <ChatInterface
      userId={profile.id}
      initialIsLoggedIn
      initialUserEmail={profile.email}
      initialFullName={uc?.full_name ?? null}
      initialProfile={profile}
      appConfig={appConfig}
    />
  );
}
