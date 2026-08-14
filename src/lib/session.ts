import { SignJWT, jwtVerify } from "jose";

/**
 * EDGE-SAFE. This file runs inside Netlify Edge Functions via middleware.
 *
 * Do not import Prisma, bcrypt, or anything Node-only here — it will build
 * fine and then fail at runtime on every request to /admin.
 */

export const SESSION_COOKIE = "s4ds_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Highest privilege first — the order the role picker renders in. */
export const ADMIN_ROLES = ["OWNER", "ADMIN", "SCANNER"] as const;

export type AdminRoleName = (typeof ADMIN_ROLES)[number];

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: AdminRoleName;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set and at least 32 characters. " +
        'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as AdminRoleName,
    };
  } catch {
    // Expired, tampered with, or signed by an old AUTH_SECRET.
    return null;
  }
}

/** OWNER can do anything an ADMIN can; ADMIN can do anything a SCANNER can. */
const RANK: Record<AdminRoleName, number> = { SCANNER: 1, ADMIN: 2, OWNER: 3 };

export function hasRole(actual: AdminRoleName, required: AdminRoleName): boolean {
  return RANK[actual] >= RANK[required];
}

/**
 * The rule for managing other admin accounts: you may only touch — and only
 * hand out — roles strictly below your own.
 *
 * Strictly, not "or equal", on purpose. If ADMINs could edit each other they
 * could demote or deactivate one another, and two OWNERs could lock each other
 * out of the only account that can undo it. The consequence is that OWNER
 * accounts are created by the seed script or directly in the database, never
 * through the UI — which is the right amount of friction for the account that
 * can delete registrations.
 *
 * Used by both the API and the UI so the buttons on screen match what the
 * route handler will actually allow.
 */
export function canManageRole(actor: AdminRoleName, target: AdminRoleName): boolean {
  return RANK[actor] > RANK[target];
}

/** Roles `actor` is allowed to assign — what the role picker should offer. */
export function assignableRoles(actor: AdminRoleName): AdminRoleName[] {
  return ADMIN_ROLES.filter((role) => canManageRole(actor, role));
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
