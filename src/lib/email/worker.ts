import "server-only";
import QRCode from "qrcode";
import { db } from "@/lib/supabase";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, type TemplateName, type TemplatePayload } from "@/lib/email/templates";

/**
 * Drains the email queue once.
 *
 * Shared by the cron route (production, every minute via Netlify) and the dev
 * watcher in src/instrumentation.ts, so both behave identically and there's
 * only one place where sending can go wrong.
 *
 * The claim is atomic (claim_email_jobs uses FOR UPDATE SKIP LOCKED), so two
 * overlapping runs take different jobs and nobody gets the same email twice.
 */

const MAX_ATTEMPTS = 4;

export type DrainResult = { claimed: number; sent: number; failed: number };

export async function processEmailQueue(batch = 5): Promise<DrainResult> {
  const { data: jobs, error } = await db.rpc("claim_email_jobs", { p_limit: batch });

  if (error) throw error;
  if (!jobs?.length) return { claimed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const payload = job.payload as unknown as TemplatePayload;
      const { subject, html, text } = renderEmail(job.template as TemplateName, payload);

      // The approval email embeds the QR so it works without opening a browser.
      const attachments =
        job.template === "approved" && payload.code
          ? [{ filename: "ticket-qr.png", content: await qrPng(payload), cid: "ticket-qr" }]
          : undefined;

      await sendEmail({ to: job.to, subject, html, text, attachments });

      await db
        .from("email_jobs")
        .update({ status: "SENT", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);

      sent += 1;
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);

      // Under the attempt cap it goes back to QUEUED and the next run retries —
      // which is how a daily Gmail rate limit resolves itself overnight.
      const giveUp = job.attempts >= MAX_ATTEMPTS;

      await db
        .from("email_jobs")
        .update({
          status: giveUp ? "FAILED" : "QUEUED",
          last_error: message.slice(0, 500),
          locked_at: null,
        })
        .eq("id", job.id);

      console.error(`email job ${job.id} (${job.template}) failed:`, message);
      failed += 1;
    }
  }

  return { claimed: jobs.length, sent, failed };
}

/**
 * The QR must encode qr_token, not the code — but the queue payload only
 * carries display data, so look the token up at send time. That also means a
 * ticket revoked before the email goes out simply won't carry a working code.
 */
async function qrPng(payload: TemplatePayload): Promise<Buffer> {
  const { data } = await db
    .from("registrations")
    .select("qr_token")
    .eq("code", payload.code)
    .maybeSingle();

  return QRCode.toBuffer(data?.qr_token ?? payload.code, {
    type: "png",
    width: 400,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
