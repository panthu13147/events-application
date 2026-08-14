import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { generateCertificatePdf } from "@/lib/certificates/generate";
import { sendCertificateEmail } from "@/lib/certificates/mailer";

export const maxDuration = 25; // same as the cron

export async function POST() {
  try {
    await requireRole("ADMIN");

    // Fetch up to 50 queued jobs
    const { data: jobs, error: fetchError } = await db
      .from("certificate_jobs")
      .select("id, registration_id, event_id, registrations(full_name, email), events(title)")
      .eq("status", "QUEUED")
      .limit(50);

    if (fetchError) {
      return NextResponse.json({ error: "Could not fetch jobs" }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ processed: 0, message: "Queue is empty" });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
