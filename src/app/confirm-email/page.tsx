import { Suspense } from "react";
import ConfirmEmailClient from "@/components/ConfirmEmailClient";

function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center animate-fade-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          <span style={{ color: "var(--primary)" }}>M</span>ulfai
        </h1>
        <div className="flex items-center justify-center gap-3 py-10">
          <svg className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Cargando...</span>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ConfirmEmailClient />
    </Suspense>
  );
}