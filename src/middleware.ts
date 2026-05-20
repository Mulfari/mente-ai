import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  // Bypass Vercel Deployment Protection for API routes
  response.headers.set("x-vercel-bypass", "true");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};