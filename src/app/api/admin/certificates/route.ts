import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/supabase";

const bodySchema = z.object({
  eventId: z.string(),
  registrationIds: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest) {
  await requireRole("ADMIN");

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { eventId, registrationIds } = parsed.data;

  let query = db
    .from("registrations")
    .select("id, email, full_name, events!inner(title)")
    .eq("event_id", eventId)
    .eq("status", "APPROVED");

  if (registrationIds?.length) {
    query = query.in("id", registrationIds);
  }

  const { data: regs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!regs?.length) return NextResponse.json({ queued: 0 });

  const jobs = regs.map((r) => {
    const event = (r as any).events;
    return {
      registration_id: r.id,
      to: r.email,
      template: "certificate",
      status: "QUEUED" as const,
      payload: {
        name: r.full_name,
        event_title: event?.title || "S4DS Event",
      },
    };
  });

  // Cannot do a clean upsert based on registration_id for email_jobs because it is not a UNIQUE constraint
  // (a user could have multiple emails like waitlisted, approved, certificate).
  // So we just insert them. We might want to check if they already exist, but for now we just queue them.
  const { error: insertError } = await db
    .from("email_jobs")
    .insert(jobs);
  
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ queued: jobs.length });
}
