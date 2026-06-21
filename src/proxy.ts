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
  // OJO: /api/auth/vps-token YA NO va aquí — hace su propio gate (logueado vs
  // anónimo). Protegerlo aquí bloquearía el trial anónimo (Bloque 1 embudo).
  "/api/analyze(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
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
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
