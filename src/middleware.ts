import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Bypass Vercel Deployment Protection for API routes
  // by removing the protection headers Vercel adds
  const response = NextResponse.next();
  response.headers.set("x-vercel-protection", "bypass");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};