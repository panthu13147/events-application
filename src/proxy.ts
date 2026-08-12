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
/** Reachable without a session, or signing in would redirect to itself. */
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Excluded here rather than in `matcher`. A negative lookahead in the matcher
  // does not survive Next's path-to-regexp compilation, so /admin/login matched
  // anyway and redirected to itself forever.
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();

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
  // Match everything under /admin; PUBLIC_ADMIN_PATHS above does the excluding.
  matcher: ["/admin", "/admin/:path*"],
};
