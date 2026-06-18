import { SignIn, ClerkLoading, ClerkLoaded } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import AuthFormSkeleton from "@/components/auth/AuthFormSkeleton";
import { vechatAuthPageAppearance } from "@/lib/clerkAppearance";

export default function SignInPage() {
  return (
    <AuthShell heading="Bienvenido de vuelta" sub="Entra y sigue conversando con lo de aquí.">
      <ClerkLoading>
        <AuthFormSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn appearance={vechatAuthPageAppearance} />
      </ClerkLoaded>
    </AuthShell>
  );
}
