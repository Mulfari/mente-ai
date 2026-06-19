"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import { AuthInput, GoogleButton, SubmitButton, ErrorMessage, OrDivider, reloadToDest } from "@/components/auth/AuthPrimitives";

export default function SignInPage() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"signin" | "reset">("signin");
  const [resetStep, setResetStep] = useState<"request" | "code" | "password">("request");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true); setError("");
    try {
      const { error: createErr } = await signIn.create({ identifier: email, password });
      if (createErr) { setError(createErr.message ?? "Correo o contraseña incorrectos."); return; }
      if (signIn.status === "complete") {
        const { error: finalErr } = await signIn.finalize();
        if (finalErr) { setError(finalErr.message ?? "No se pudo iniciar sesión."); return; }
        reloadToDest();
      } else setError("No se pudo iniciar sesión.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Correo o contraseña incorrectos.");
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    if (!signIn) return;
    await signIn.sso({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectCallbackUrl: "/" });
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true); setError("");
    try {
      const { error: createErr } = await signIn.create({ identifier: email });
      if (createErr) { setError(createErr.message ?? "No encontramos esa cuenta."); return; }
      const { error: sendErr } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendErr) { setError(sendErr.message ?? "No se pudo enviar el código."); return; }
      setResetStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally { setLoading(false); }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true); setError("");
    try {
      const { error: verifyErr } = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (verifyErr) { setError(verifyErr.message ?? "Código inválido."); return; }
      setResetStep("password"); // código verificado → ahora se pide la nueva contraseña
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally { setLoading(false); }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true); setError("");
    try {
      const { error: pwErr } = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
      if (pwErr) { setError(pwErr.message ?? "No se pudo cambiar la contraseña."); return; }
      if (signIn.status === "complete") {
        const { error: finalErr } = await signIn.finalize();
        if (finalErr) { setError(finalErr.message ?? "No se pudo entrar."); return; }
        reloadToDest();
      } else setError("No se pudo completar el cambio.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally { setLoading(false); }
  }

  if (view === "reset") {
    const resetSub =
      resetStep === "request" ? "Pon tu correo y te enviamos un código."
      : resetStep === "code" ? "Escribe el código que te llegó al correo."
      : "Crea tu nueva contraseña.";
    return (
      <AuthShell heading="Recupera tu cuenta" sub={resetSub}>
        {resetStep === "request" && (
          <form onSubmit={handleResetRequest} className="flex flex-col gap-4">
            <AuthInput id="email" label="Correo" type="email" placeholder="tu@correo.com" value={email} onChange={setEmail} autoComplete="email" autoFocus />
            <SubmitButton loading={loading}>Enviar código</SubmitButton>
            <ErrorMessage message={error} />
          </form>
        )}
        {resetStep === "code" && (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
            <AuthInput id="code" label="Código" type="text" placeholder="123456" value={code} onChange={setCode} autoComplete="one-time-code" autoFocus />
            <SubmitButton loading={loading}>Verificar código</SubmitButton>
            <ErrorMessage message={error} />
          </form>
        )}
        {resetStep === "password" && (
          <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
            <AuthInput id="newPassword" label="Nueva contraseña" type="password" placeholder="Mínimo 8 caracteres" value={newPassword} onChange={setNewPassword} autoComplete="new-password" autoFocus />
            <AuthInput id="confirmPassword" label="Confirmar contraseña" type="password" placeholder="Repite la contraseña" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            <SubmitButton loading={loading}>Cambiar contraseña</SubmitButton>
            <ErrorMessage message={error} />
          </form>
        )}
        <button type="button" onClick={() => { setView("signin"); setError(""); setResetStep("request"); setCode(""); setNewPassword(""); setConfirmPassword(""); }}
          className="mt-4 block w-full cursor-pointer text-center text-[13px] font-medium underline underline-offset-2"
          style={{ color: "var(--text-secondary)" }}>
          Volver a iniciar sesión
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Bienvenido de vuelta" sub="Entra y sigue conversando con lo de aquí.">
      <GoogleButton onClick={handleGoogle} disabled={!signIn} />
      <OrDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthInput id="email" label="Correo" type="email" placeholder="tu@correo.com" value={email} onChange={setEmail} autoComplete="email" autoFocus />
        <AuthInput id="password" label="Contraseña" type="password" placeholder="Tu contraseña" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="button" onClick={() => { setView("reset"); setError(""); }}
          className="-mt-1 cursor-pointer self-end text-[12.5px] font-medium" style={{ color: "var(--primary)" }}>
          ¿Olvidaste tu contraseña?
        </button>
        <SubmitButton loading={loading}>Iniciar sesión</SubmitButton>
        <ErrorMessage message={error} />
      </form>
      <p className="mt-5 text-center text-[13px]" style={{ color: "var(--text-secondary)" }}>
        ¿No tienes cuenta? <a href="/sign-up" className="font-medium underline underline-offset-2" style={{ color: "var(--primary)" }}>Crear cuenta</a>
      </p>
    </AuthShell>
  );
}
