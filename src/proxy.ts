import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Rutas que requieren usuario autenticado
const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/admin(.*)",
  "/agent(.*)",
  "/context(.*)",
  "/api/chat(.*)",
  "/api/user-context(.*)",
  "/api/coupons(.*)",
  "/api/admin(.*)",
  "/api/auth/vps-token(.*)",
  "/api/analyze(.*)",
  "/api/research(.*)",
]);

export default clerkMiddleware(
  async (auth, req) => {
    // Canonical redirect: el apex sirve la app solo para que el proxy de
    // Clerk (/__clerk, interceptado antes de llegar aqui) viva en el mismo
    // dominio registrado en Clerk. Todo lo demas va a www.
    if (req.nextUrl.hostname === "mulfai.com.ve") {
      const url = req.nextUrl.clone();
      url.hostname = "www.mulfai.com.ve";
      return NextResponse.redirect(url, 308);
    }

    // Proteger rutas privadas con Clerk
    if (isProtectedRoute(req)) {
      await auth.protect();
    }

    // Set Vercel bypass cookie for deployment protection
    const response = NextResponse.next();
    response.cookies.set("vercel-bypass", "true", {
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: "lax",
    });
    response.headers.set("x-vercel-bypass", "true");
    return response;
  },
  {
    // Proxy de la Frontend API por /__clerk en el dominio apex (Clerk exige
    // que el proxy viva en el mismo dominio registrado: mulfai.com.ve, sin
    // www). El navegador habla con mulfai.com.ve/__clerk y este middleware
    // reenvía a Clerk. Registrado via API: PATCH /v1/domains proxy_url.
    proxyUrl: "https://mulfai.com.ve/__clerk",
    frontendApiProxy: { enabled: true },
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
