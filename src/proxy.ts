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
    // Proxy de la Frontend API por /__clerk en nuestro propio dominio.
    // Evita configurar el CNAME clerk.mulfai.com.ve: el navegador habla con
    // www.mulfai.com.ve/__clerk y el middleware reenvía a Clerk. Requiere
    // registrar el proxy URL en Clerk Dashboard → Domains → Frontend API.
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
