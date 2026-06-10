import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ContextEditor from "@/components/ContextEditor";

export default async function ContextPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <ContextEditor />;
}
