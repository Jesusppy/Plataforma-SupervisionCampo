import { NextResponse, type NextRequest } from "next/server";

import { AUTH_TOKEN_COOKIE_NAME, isServerSessionValid } from "./lib/session";

const PROTECTED_PREFIXES = ["/projects", "/visits", "/reports"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value;
  const jwtSecret = process.env.JWT_SECRET_KEY ?? process.env.NEXT_JWT_SECRET_KEY;

  if (await isServerSessionValid(token, jwtSecret)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  if (token) {
    loginUrl.searchParams.set("reason", "session-expired");
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/projects/:path*", "/visits/:path*", "/reports/:path*"],
};