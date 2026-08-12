import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireRole, AuthError } from "@/lib/auth";
import { registrationStatusSchema } from "@/lib/validation";

/**
 * Approve / reject a registration.
 *
 * Approving is what makes the ticket scannable — the scanner refuses anything
 * that isn't APPROVED, so this is the gate between "paid" and "gets in".
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { id } = await params;
  const parsed = registrationStatusSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await db
    .from("registrations")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .select("id, code, status, full_name, email")
    .maybeSingle();

  if (error) {
    console.error("registration update failed:", error);
    return NextResponse.json({ error: "Could not update" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // TODO(Track D): enqueueEmail — "you're in, here's your ticket" on APPROVED,
  // and the rejection note (parsed.data.reason) on REJECTED. Until the queue
  // exists, students only find out by opening their ticket link.

  return NextResponse.json({ ok: true, registration: data });
}

/**
 * Permanently delete a registration.
 *
 * This is not the same as rejecting. Rejecting keeps the record and the payment
 * proof, so there's still an audit trail if someone disputes it. Delete removes
 * the row, its attendance and its certificate (ON DELETE CASCADE), and frees
 * the email to register again. Use it for test rows and duplicates.
 *
 * OWNER only — one careless click on a phone shouldn't erase a paid
 * registration, and volunteers have no reason to reach this at all.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("OWNER");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { id } = await params;

  const { data, error } = await db
    .from("registrations")
    .delete()
    .eq("id", id)
    .select("id, code")
    .maybeSingle();

  if (error) {
    console.error("registration delete failed:", error);
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deleted: data.code });
}
