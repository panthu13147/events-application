import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { generateCertificatePdf } from "@/lib/certificates/generate";
import { sendCertificateEmail } from "@/lib/certificates/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

export async function POST(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Claim up to 5 jobs
  const { data: jobs, error: fetchError } = await db
    .from("certificate_jobs")
    .select("id, registration_id, event_id, registrations(full_name, email), events(title)")
    .eq("status", "QUEUED")
    .limit(5);

  if (fetchError) {
    return NextResponse.json({ error: "Could not fetch jobs" }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Mark them as SENDING
  const jobIds = jobs.map((j) => j.id);
  await db.from("certificate_jobs").update({ status: "SENDING" }).in("id", jobIds);

  let successCount = 0;
  let failCount = 0;

  for (const job of jobs) {
    try {
      const reg = job.registrations as any;
      const evt = job.events as any;

      if (!reg || !evt) throw new Error("Missing registration or event data");

      const pdfBytes = await generateCertificatePdf(reg.full_name);

      await sendCertificateEmail({
        to: reg.email,
        participantName: reg.full_name,
        eventName: evt.title,
        pdfBytes,
      });

      await db.from("certificate_jobs").update({ status: "SENT" }).eq("id", job.id);
      successCount++;
    } catch (e: any) {
      console.error(`Job ${job.id} failed:`, e);
      await db
        .from("certificate_jobs")
        .update({ status: "FAILED", error_msg: e.message })
        .eq("id", job.id);
      failCount++;
    }
  }

  return NextResponse.json({ processed: jobs.length, success: successCount, failed: failCount });
}
