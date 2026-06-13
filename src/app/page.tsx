import { auth } from "@clerk/nextjs/server";
import ChatInterface from "@/components/ChatInterface";
import { getOrCreateProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/appConfig";

// Un solo chat para todos: el visitante deslogueado ve exactamente la misma
// interfaz (hero + input + feed de tendencias); interactuar lo lleva a crear
// cuenta con su pregunta guardada. El logueado además tiene su historial.
export default async function Home() {
  const [{ userId }, appConfig] = await Promise.all([auth(), getAppConfig()]);

  if (!userId) {
    return <ChatInterface userId="" initialIsLoggedIn={false} appConfig={appConfig} />;
  }

  const profile = await getOrCreateProfile(userId);
  if (!profile) {
    // DB caída — modo visitante antes que un crash.
    return <ChatInterface userId="" initialIsLoggedIn={false} appConfig={appConfig} />;
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
