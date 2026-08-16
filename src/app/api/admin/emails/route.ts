import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { requireRole, AuthError } from "@/lib/auth";
import { processEmailQueue, sendEmailJob } from "@/lib/email/worker";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("drain") }),
  z.object({ action: z.literal("retry"), id: z.string().min(1) }),
  z.object({ action: z.literal("send_one"), id: z.string().min(1) }),
  z.object({ action: z.literal("delete"), id: z.string().min(1) }),
]);

/**
 * Manual controls for the email queue.
 *
 * The scheduled worker handles the normal case. This exists for the two moments
 * you actually need hands on it: "send it now" while someone is standing in
 * front of you, and "try that failed one again" after fixing the cause.
 */
export async function POST(request: Request) {
  try {
    await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (parsed.data.action === "retry") {
    // Reset attempts too, or a job that already burned through the retry cap
    // gets marked FAILED again on its very next run.
    const { error } = await db
      .from("email_jobs")
      .update({ status: "QUEUED", attempts: 0, last_error: null, locked_at: null })
      .eq("id", parsed.data.id);

    if (error) {
      return NextResponse.json({ error: "Could not requeue" }, { status: 500 });
    }
  }

  if (parsed.data.action === "delete") {
    const { error } = await db.from("email_jobs").delete().eq("id", parsed.data.id);
    if (error) return NextResponse.json({ error: "Could not delete" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (parsed.data.action === "send_one") {
    try {
      // First update status to SENDING so it doesn't get picked up by a race condition drain
      await db.from("email_jobs").update({ status: "SENDING", locked_at: new Date().toISOString() }).eq("id", parsed.data.id);
      await sendEmailJob(parsed.data.id);
      return NextResponse.json({ success: true });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  try {
    // Bigger batch than the cron's 5 — this runs on a real request, not inside
    // a Netlify function with a 10s ceiling.
    return NextResponse.json(await processEmailQueue(15, true));
  } catch (error) {
    console.error("manual drain failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send" },
      { status: 500 },
    );
  }
}
