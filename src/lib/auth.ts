import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
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
  const session = await getSession();
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
