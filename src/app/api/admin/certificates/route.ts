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
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "APPROVED");

  if (registrationIds?.length) {
    query = query.in("id", registrationIds);
  }

  const { data: regs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!regs?.length) return NextResponse.json({ queued: 0 });

  const jobs = regs.map((r) => ({
    registration_id: r.id,
    event_id: eventId,
    status: "QUEUED" as const,
  }));

  const { error: insertError } = await db
    .from("certificate_jobs")
    .upsert(jobs, { onConflict: "registration_id" });
  
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ queued: jobs.length });
}
