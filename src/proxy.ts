import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, hasRole, verifySession } from "@/lib/session";

/**
 * Runs as a Netlify Edge Function.
 *
 * It may ONLY verify the JWT — no Prisma, no bcrypt, no DB lookups. Anything
 * Node-only here builds fine and then fails at runtime on every /admin request.
 *
 * This is a redirect convenience, not the authorization boundary. Every admin
 * route handler re-checks with requireRole().
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // Volunteers get the scanner and nothing else.
  const isScannerRoute = pathname.startsWith("/admin/scan");
  const required = isScannerRoute ? "SCANNER" : "ADMIN";

  if (!hasRole(session.role, required)) {
    const fallback = hasRole(session.role, "SCANNER") ? "/admin/scan" : "/admin/login";
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // /admin/login is excluded, otherwise signing in would redirect to itself.
  matcher: ["/admin/((?!login).*)", "/admin"],
};
