import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import {
  SESSION_COOKIE,
  hasRole,
  verifySession,
  type AdminRoleName,
  type SessionPayload,
} from "@/lib/session";

/**
 * Server-side session helpers for route handlers and server components.
 *
 * Middleware already blocks unauthenticated requests to /admin, but route
 * handlers must check again: middleware is a convenience for redirecting
 * humans, not an authorization boundary for the API.
 */

/** Trusts the cookie alone. Prefer getActiveSession() unless you only need the id. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The session, re-read against the database.
 *
 * The JWT carries `role` and lives for seven days, so on the cookie alone both
 * "deactivate this volunteer after the event" and "demote this admin" would do
 * nothing until it expired. One primary-key lookup per guarded request buys a
 * deactivate button that isn't a lie, and role changes that take effect on the
 * next request instead of next week.
 *
 * Returns null when signed out, deleted, or deactivated — all three should end
 * the same way, at the login page.
 */
export async function getActiveSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await db
    .from("admin_users")
    .select("id, email, name, role, is_active")
    .eq("id", session.sub)
    .maybeSingle();

  // Fail closed. A Supabase blip must not read as "still signed in".
  if (error) throw error;
  if (!data || !data.is_active) return null;

  return { sub: data.id, email: data.email, name: data.name, role: data.role };
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

/** Throws AuthError. Wrap route handlers with `withAuth` to turn it into a response. */
export async function requireRole(required: AdminRoleName): Promise<SessionPayload> {
  const session = await getActiveSession();
  if (!session) throw new AuthError("Not signed in", 401);
  if (!hasRole(session.role, required)) {
    throw new AuthError(`Requires ${required} role`, 403);
  }
  return session;
}

/**
 * Usage:
 *   export const POST = withAuth("ADMIN", async (req, session) => { ... });
 */
export function withAuth<T>(
  required: AdminRoleName,
  handler: (request: Request, session: SessionPayload) => Promise<T>,
) {
  return async (request: Request) => {
    let session: SessionPayload;
    try {
      session = await requireRole(required);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
    return handler(request, session);
  };
}
