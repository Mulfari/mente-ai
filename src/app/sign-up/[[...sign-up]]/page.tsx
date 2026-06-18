import { SignUp, ClerkLoading, ClerkLoaded } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import AuthFormSkeleton from "@/components/auth/AuthFormSkeleton";
import { vechatAuthPageAppearance } from "@/lib/clerkAppearance";

export default function SignUpPage() {
  return (
    <AuthShell heading="Crea tu cuenta" sub="Gratis para empezar — en 10 segundos, sin tarjeta.">
      <ClerkLoading>
        <AuthFormSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <SignUp appearance={vechatAuthPageAppearance} />
      </ClerkLoaded>
    </AuthShell>
  );
}
