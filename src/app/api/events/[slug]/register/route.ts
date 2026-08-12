import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getFormFields } from "@/config/forms";
import { buildAnswersSchema } from "@/lib/form-types";
import { registrationBaseSchema } from "@/lib/validation";
import { generateCode, generateQrToken } from "@/lib/ids";
import type { Json } from "@/lib/database.types";
import { enqueueEmail } from "@/lib/email/queue";
import { emailPayload } from "@/lib/email/payload";

/**
 * Registration.
 *
 * The capacity check and the insert happen inside the `register_for_event`
 * Postgres function, not here. Counting in JS and then inserting would let two
 * students both take the last spot — see supabase/migrations/0002_functions.sql.
 */

const ERRORS: Record<string, { status: number; message: string }> = {
  CAPACITY_FULL: {
    status: 409,
    message: "All spots have been taken. Registration is now full.",
  },
  REGISTRATION_CLOSED: {
    status: 403,
    message: "Registration for this event is closed.",
  },
  DUPLICATE_EMAIL: {
    status: 409,
    message: "This email is already registered for this event. Use /retrieve to get your ticket.",
  },
  EVENT_NOT_FOUND: { status: 404, message: "Event not found." },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const { data: event, error: eventError } = await db
    .from("events")
    .select("id, form_key, requires_payment, capacity")
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();

  if (eventError) {
    console.error("register: event lookup failed", eventError);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const base = registrationBaseSchema.safeParse(body);

  if (!base.success) {
    return NextResponse.json(
      { error: base.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }

  // The event's own questions are validated from the same registry the form
  // rendered from, so a client that skips a field can't get past here.
  const answers = buildAnswersSchema(getFormFields(event.form_key)).safeParse(base.data.answers);

  if (!answers.success) {
    const issue = answers.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Some answers are missing or invalid." },
      { status: 400 },
    );
  }

  // Waitlisted people don't pay. Asking for a deposit to *maybe* get a seat is
  // a bad deal and creates refunds for everyone who never gets promoted — so
  // the deposit is collected when they're promoted, not now.
  //
  // The seat count can change between this check and the insert. The RPC has
  // the final say on status, so the worst case is someone who paid lands on the
  // waitlist, or someone gets a seat without a proof. The latter shows up as
  // "no proof" in the approvals list, where an admin sees it before approving.
  let waitlisting = false;
  if (event.capacity !== null) {
    const { count } = await db
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .in("status", ["PENDING", "APPROVED"]);

    waitlisting = (count ?? 0) >= event.capacity;
  }

  if (event.requires_payment && !waitlisting && !base.data.payment_proof_url) {
    return NextResponse.json(
      { error: "Upload a screenshot of your payment to continue." },
      { status: 400 },
    );
  }

  const { data, error } = await db.rpc("register_for_event", {
    p_event_id: event.id,
    p_code: generateCode(),
    p_qr_token: generateQrToken(),
    p_full_name: base.data.full_name,
    p_email: base.data.email,
    p_phone: base.data.phone ?? null,
    // Validated above against the event's own field definitions, so this is a
    // flat object of primitives by construction.
    p_answers: answers.data as Json,
    p_payment_proof_url: base.data.payment_proof_url ?? null,
  });

  if (error) {
    // The function raises named exceptions; Postgres puts the text in `message`.
    const known = Object.keys(ERRORS).find((key) => error.message?.includes(key));
    if (known) {
      return NextResponse.json({ error: ERRORS[known].message }, { status: ERRORS[known].status });
    }
    console.error("register_for_event failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const registration = Array.isArray(data) ? data[0] : data;

  await enqueueEmail({
    to: registration.email,
    // The RPC decides the status, so the email always matches what actually
    // happened — no "you're registered" to someone who landed on the waitlist.
    template: registration.status === "WAITLISTED" ? "waitlisted" : "confirmation",
    registration_id: registration.id,
    payload: await emailPayload(event.id, registration.full_name, registration.code),
  });

  return NextResponse.json({ code: registration.code, status: registration.status });
}
