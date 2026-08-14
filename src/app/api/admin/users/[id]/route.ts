import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireRole, AuthError } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { canManageRole } from "@/lib/session";
import { adminUserUpdateSchema } from "@/lib/validation";

/**
 * Change an account's role, deactivate it, or reset its password.
 *
 * There is no DELETE. attendance.scanned_by holds an admin_users.id as plain
 * text with no foreign key, so removing the row would orphan every scan that
 * volunteer recorded. Deactivating keeps the trail and can be undone when the
 * same person turns up for the next event.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { id } = await params;

  // Nobody edits their own account here. Otherwise the last OWNER can demote
  // or deactivate themselves and there is no way back in through the UI.
  if (id === session.sub) {
    return NextResponse.json(
      { error: "You cannot change your own account" },
      { status: 403 },
    );
  }

  const parsed = adminUserUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid changes" },
      { status: 400 },
    );
  }

  const { data: target, error: lookupError } = await db
    .from("admin_users")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("admin user lookup failed:", lookupError);
    return NextResponse.json({ error: "Could not load the account" }, { status: 500 });
  }

  if (!target) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Two checks, not one: you must outrank who they are now, and you must
  // outrank what you're turning them into. Without the second, an ADMIN could
  // promote a volunteer to OWNER and inherit that access through them.
  if (!canManageRole(session.role, target.role)) {
    return NextResponse.json(
      { error: `A ${session.role} cannot change a ${target.role} account` },
      { status: 403 },
    );
  }

  const { name, role, is_active, password } = parsed.data;

  if (role && !canManageRole(session.role, role)) {
    return NextResponse.json(
      { error: `A ${session.role} cannot grant the ${role} role` },
      { status: 403 },
    );
  }

  const { data, error } = await db
    .from("admin_users")
    .update({
      ...(name !== undefined ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
      ...(password !== undefined ? { password_hash: await hashPassword(password) } : {}),
    })
    .eq("id", id)
    .select("id, email, name, role, is_active, created_at")
    .maybeSingle();

  if (error || !data) {
    console.error("admin user update failed:", error);
    return NextResponse.json({ error: "Could not save the change" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: data });
}
