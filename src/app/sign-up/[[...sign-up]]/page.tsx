"use client";

import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import { AuthInput, GoogleButton, SubmitButton, ErrorMessage, OrDivider, reloadToDest } from "@/components/auth/AuthPrimitives";

export default function SignUpPage() {
  const { signUp } = useSignUp();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true); setError("");
    try {
      const { error: createErr } = await signUp.create({ emailAddress: email, password });
      if (createErr) { setError(createErr.message ?? "No se pudo crear la cuenta."); return; }
      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) { setError(sendErr.message ?? "No se pudo enviar el código."); return; }
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally { setLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true); setError("");
    try {
      const { error: verifyErr } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyErr) { setError(verifyErr.message ?? "Código inválido."); return; }
      if (signUp.status === "complete") {
        const { error: finalErr } = await signUp.finalize();
        if (finalErr) { setError(finalErr.message ?? "No se pudo completar el registro."); return; }
        reloadToDest();
      } else setError("Código inválido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally { setLoading(false); }
  }

  async function handleResend() {
    if (!signUp) return;
    setError("");
    const { error: resendErr } = await signUp.verifications.sendEmailCode();
    if (resendErr) setError(resendErr.message ?? "No se pudo reenviar el código.");
  }

  async function handleGoogle() {
    if (!signUp) return;
    await signUp.sso({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectCallbackUrl: "/" });
  }

  if (step === "verify") {
    return (
      <AuthShell heading="Verifica tu correo" sub={`Enviamos un código a ${email}.`}>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <AuthInput id="code" label="Código de verificación" type="text" placeholder="123456" value={code} onChange={setCode} autoComplete="one-time-code" autoFocus />
          <SubmitButton loading={loading}>Verificar</SubmitButton>
          <ErrorMessage message={error} />
        </form>
        <button type="button" onClick={handleResend}
          className="mt-4 block w-full cursor-pointer text-center text-[13px] font-medium underline underline-offset-2"
          style={{ color: "var(--primary)" }}>
          Reenviar código
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Crea tu cuenta" sub="Gratis para empezar — en 10 segundos, sin tarjeta.">
      <GoogleButton onClick={handleGoogle} disabled={!signUp} />
      <OrDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthInput id="email" label="Correo" type="email" placeholder="tu@correo.com" value={email} onChange={setEmail} autoComplete="email" autoFocus />
        <AuthInput id="password" label="Contraseña" type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={setPassword} autoComplete="new-password" />
        {/* Clerk monta su Smart CAPTCHA aquí. Sin este div, los registros headless se bloquean. */}
        <div id="clerk-captcha" />
        <SubmitButton loading={loading}>Crear cuenta</SubmitButton>
        <ErrorMessage message={error} />
      </form>
      <p className="mt-4 text-center text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        Al crear tu cuenta aceptas los <a href="/terminos" className="underline underline-offset-2" style={{ color: "var(--text-secondary)" }}>Términos</a> y la <a href="/privacidad" className="underline underline-offset-2" style={{ color: "var(--text-secondary)" }}>Privacidad</a>.
      </p>
      <p className="mt-5 text-center text-[13px]" style={{ color: "var(--text-secondary)" }}>
        ¿Ya tienes cuenta? <a href="/sign-in" className="font-medium underline underline-offset-2" style={{ color: "var(--primary)" }}>Iniciar sesión</a>
      </p>
    </AuthShell>
  );
}
