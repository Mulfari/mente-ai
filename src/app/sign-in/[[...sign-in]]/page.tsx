import { SignIn } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  );
}
