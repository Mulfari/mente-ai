import { auth } from "@clerk/nextjs/server";
import ChatInterface from "@/components/ChatInterface";
import LandingPageGate from "@/components/landing/LandingPageGate";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPageGate />;
  }

  return <ChatInterface userId={userId} />;
}
