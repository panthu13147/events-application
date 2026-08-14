import { NextResponse } from "next/server";
import { db, isUniqueViolation } from "@/lib/supabase";
import { requireRole, AuthError } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { canManageRole } from "@/lib/session";
import { adminUserCreateSchema } from "@/lib/validation";

/**
 * Admin accounts — this is how a SCANNER account comes to exist.
 *
 * Volunteers don't sign up; someone with an account makes them one before the
 * event and reads them the password. There is no invite email and no password
 * reset flow: a two-day event doesn't need one, and a reset link is one more
 * thing that can leak an admin account.
 *
 * Who may do what is canManageRole() — strictly below your own rank — so an
 * ADMIN manages volunteers and an OWNER manages everyone but other OWNERs.
 */

const FIELDS = "id, email, name, role, is_active, created_at";

export async function GET() {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { data, error } = await db
    .from("admin_users")
    .select(FIELDS)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("admin user list failed:", error);
    return NextResponse.json({ error: "Could not load accounts" }, { status: 500 });
  }

  // Everyone with access can see the full list — knowing who holds an account
  // is the point. `can_manage` is what the row's buttons key off.
  return NextResponse.json({
    users: (data ?? []).map((user) => ({
      ...user,
      can_manage: user.id !== session.sub && canManageRole(session.role, user.role),
      is_self: user.id === session.sub,
    })),
  });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = adminUserCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid account details" },
      { status: 400 },
    );
  }

  const { name, email, password, role } = parsed.data;

  if (!canManageRole(session.role, role)) {
    return NextResponse.json(
      { error: `A ${session.role} cannot create a ${role} account` },
      { status: 403 },
    );
  }

  const { data, error } = await db
    .from("admin_users")
    .insert({ name, email, role, password_hash: await hashPassword(password) })
    .select(FIELDS)
    .maybeSingle();

  // admin_users.email is unique — let the constraint answer rather than
  // checking first, which races two people adding the same volunteer.
  if (isUniqueViolation(error)) {
    return NextResponse.json(
      { error: "An account already uses that email" },
      { status: 409 },
    );
  }

  if (error || !data) {
    console.error("admin user create failed:", error);
    return NextResponse.json({ error: "Could not create the account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: data }, { status: 201 });
}
