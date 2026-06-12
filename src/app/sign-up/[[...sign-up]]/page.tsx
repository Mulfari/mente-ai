import { SignUp } from "@clerk/nextjs";
import AuthShell, { authAppearance } from "@/components/auth/AuthShell";

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp appearance={authAppearance} />
    </AuthShell>
  );
}
