// src/middleware.ts

import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Pages reachable without signing in. Every other page requires a session,
// so new tool pages are protected by default.
const PUBLIC_PATHS = ["/", "/home", "/login", "/signup", "/forgot-password", "/reset-password"];

// Optimistic check on the session cookie only; API routes validate the
// session on the server themselves.
export function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next.js internals and static files (including the app
  // icons, which the login and landing pages need too).
  matcher: ["/((?!api|_next/static|_next/image|images|favicon.ico|icon.svg|apple-icon.png).*)"],
};
