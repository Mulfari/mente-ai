// Server component wrapper for /agent — forces dynamic rendering so the
// client component (which uses useUser) doesn't fail during Next.js prerender.
export const dynamic = "force-dynamic";

import AgentClient from "./AgentClient";

export default function AgentPage() {
  return <AgentClient />;
}
