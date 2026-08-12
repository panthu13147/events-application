import "server-only";
import {
  createClient,
  type PostgrestError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * SERVER ONLY. The `server-only` import above makes the build fail if a client
 * component ever imports this file.
 *
 * Every table is RLS-enabled with no policies, so the anon key can read
 * nothing. All access goes through the service_role key, which bypasses RLS —
 * which means our route handlers ARE the authorization boundary. Every admin
 * route must call requireRole().
 *
 * The service_role key is not prefixed NEXT_PUBLIC_ and must never be.
 */

let client: SupabaseClient<Database> | null = null;

function getClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Copy .env.example to .env.",
    );
  }

  client = createClient<Database>(url, serviceRoleKey, {
    auth: {
      // We run our own admin sessions; there is no Supabase Auth user here and
      // nothing to persist or refresh in a serverless function.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}

/**
 * Created on first use rather than at import time.
 *
 * `next build` evaluates every module while collecting page data, so a client
 * constructed at module scope would make the build fail on any machine that
 * hasn't filled in .env yet — including a fresh clone. Deferring it means a
 * missing key surfaces as a clear runtime error on the request that needs it.
 */
export const db = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property, receiver) {
    const value = Reflect.get(getClient(), property, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});

/**
 * supabase-js returns errors instead of throwing. Route handlers should call
 * this so a failed query can never be silently treated as "no rows".
 */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw result.error;
  if (result.data === null) {
    throw new Error("Query returned no data");
  }
  return result.data;
}

/** Postgres unique-constraint violation — e.g. a second scan on the same day. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
