"use client";

import LandingPage from "./LandingPage";

export default function LandingPageGate() {
  return (
    <LandingPage
      onShowAuth={(m) => {
        // Redirect to Clerk's catch-all routes. After successful auth,
        // Clerk redirects to NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL (configured to /chat).
        window.location.href = m === "login" ? "/sign-in" : "/sign-up";
      }}
    />
  );
}
