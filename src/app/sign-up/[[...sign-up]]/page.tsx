import { SignUp } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import { vechatAuthPageAppearance } from "@/lib/clerkAppearance";

export default function SignUpPage() {
  return (
    <AuthShell heading="Crea tu cuenta" sub="Gratis para empezar — en 10 segundos, sin tarjeta.">
      <SignUp appearance={vechatAuthPageAppearance} />
    </AuthShell>
  );
}
