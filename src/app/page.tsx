import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import ChatInterface from "@/components/ChatInterface";
import PublicHome from "@/components/home/PublicHome";
import { getOrCreateProfile } from "@/lib/profile";
import { getPublicFeed } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";

// Ciudad del visitante por IP (header de Vercel, URL-encoded). Sirve para la
// sección "Cerca de ti" del feed público.
async function visitorCity(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-vercel-ip-city");
  if (!raw) return null;
  try {
    const city = decodeURIComponent(raw).trim();
    return city ? city : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    const city = await visitorCity();
    const feed = await getPublicFeed(city);
    return <PublicHome feed={feed} />;
  }

  const profile = await getOrCreateProfile(userId);
  if (!profile) {
    // DB caída — mejor la home pública que un crash.
    const feed = await getPublicFeed(null);
    return <PublicHome feed={feed} />;
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
    />
  );
}
