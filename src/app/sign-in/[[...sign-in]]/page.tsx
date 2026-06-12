import { SignIn } from "@clerk/nextjs";
import AuthShell, { authAppearance } from "@/components/auth/AuthShell";

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn appearance={authAppearance} />
    </AuthShell>
  );
}
