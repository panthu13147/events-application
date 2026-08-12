import bcrypt from "bcryptjs";

/**
 * NODE-ONLY. bcryptjs does not run in edge middleware — keep it out of
 * src/lib/session.ts, which does.
 */

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
