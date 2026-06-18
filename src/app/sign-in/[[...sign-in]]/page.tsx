import { SignIn } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import { vechatAuthPageAppearance } from "@/lib/clerkAppearance";

export default function SignInPage() {
  return (
    <AuthShell heading="Bienvenido de vuelta" sub="Entra y sigue conversando con lo de aquí.">
      <SignIn appearance={vechatAuthPageAppearance} />
    </AuthShell>
  );
}
