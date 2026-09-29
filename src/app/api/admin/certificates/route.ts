import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { eventSendsEmail } from "@/lib/email/queue";

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

  // This route writes to email_jobs directly rather than through
  // enqueueEmail, so it has to run the no-email check itself — see
  // src/config/event-features.
  if (!(await eventSendsEmail(eventId))) {
    return NextResponse.json({
      queued: 0,
      skipped: "This event does not send email. Certificates were not queued.",
    });
  }

  let query = db
    .from("registrations")
    .select("id, email, full_name, answers, events!inner(title, slug)")
    .eq("event_id", eventId)
    .eq("status", "APPROVED");

  if (registrationIds?.length) {
    query = query.in("id", registrationIds);
  }

  const { data: regs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!regs?.length) return NextResponse.json({ queued: 0 });

  const jobs: any[] = [];

  for (const r of regs) {
    const event = (r as any).events;
    const answers = (r.answers as Record<string, any>) || {};
    const teamName = answers.team_name || answers.Team || answers.team || "";

    // Collect all team members (leader + member2/3/4)
    const members: { name: string; email: string }[] = [];
    if (r.full_name?.trim()) {
      members.push({ name: r.full_name.trim(), email: r.email.trim() });
    }
    for (const num of [2, 3, 4]) {
      const mName = answers[`member${num}_name`]?.trim();
      const mEmail = answers[`member${num}_email`]?.trim();
      if (mName && mEmail) {
        members.push({ name: mName, email: mEmail });
      }
    }

    // One email to the team leader with ALL team members' certificates attached
    jobs.push({
      registration_id: r.id,
      to: r.email.trim(),
      template: "certificate",
      status: "QUEUED" as const,
      payload: {
        name: r.full_name.trim(),
        event_title: event?.title || "S4DS Event",
        event_slug: event?.slug || "",
        answers: { ...answers, team_name: teamName },
        team_members: members,
      },
    });
  }

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
