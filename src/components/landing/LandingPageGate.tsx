"use client";

import { useState } from "react";
import LandingPage from "./LandingPage";
import AuthModal from "@/components/AuthModal";

export default function LandingPageGate() {
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

  return (
    <>
      <LandingPage onShowAuth={(m) => setAuthMode(m)} />
      {authMode && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
