import "server-only";
import QRCode from "qrcode";
import { db } from "@/lib/supabase";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, type TemplateName, type TemplatePayload } from "@/lib/email/templates";
import { WHATSAPP_ICON_PNG } from "@/lib/email/assets";
import { generateCertificatePdf } from "@/lib/certificates/generate";
import { generateKnowbuildCertificatePdf } from "@/lib/certificates/knowbuild";

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

export async function processEmailQueue(batch = 5, includeCertificates = false): Promise<DrainResult> {
  const { data: jobs, error } = await db.rpc("claim_email_jobs", { 
    p_limit: batch, 
    p_include_certificates: includeCertificates 
  });

  if (error) throw error;
  if (!jobs?.length) return { claimed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const payload = job.payload as unknown as TemplatePayload;
      const { subject, html, text } = renderEmail(job.template as TemplateName, payload);
      const attachments = await attachmentsFor(job.template as TemplateName, payload);

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

type Attachment = { filename: string; content: Buffer; cid?: string; contentType?: string };

/**
 * What to attach, kept in one place so the two send paths below can't drift.
 * Must agree with templates.ts about when each cid actually appears in the
 * HTML — an attachment nothing references is harmless, but a cid referenced
 * with nothing attached renders as a broken image.
 */
async function attachmentsFor(
  template: TemplateName,
  payload: TemplatePayload,
): Promise<Attachment[] | undefined> {
  if (template === "approved" && payload.code) {
    const attachments: Attachment[] = [
      { filename: "whatsapp.png", content: WHATSAPP_ICON_PNG, cid: "whatsapp-icon" },
    ];
    // has_ticket === false means this event issues no QR at all (see
    // event-features.ticket) — the template already skips the <img
    // src="cid:ticket-qr">, so attaching one anyway would just be dead weight.
    if (payload.has_ticket !== false) {
      attachments.push({ filename: "ticket-qr.png", content: await qrPng(payload), cid: "ticket-qr" });
    }
    return attachments;
  }

  // "confirmation" only renders a WhatsApp button when the event has a
  // community group configured — see communityButton() in templates.ts.
  if (template === "confirmation" && payload.community) {
    return [{ filename: "whatsapp.png", content: WHATSAPP_ICON_PNG, cid: "whatsapp-icon" }];
  }

  if (template === "certificate") {
    const slug = (payload as any).event_slug || "";
    const answers = (payload as any).answers || {};
    const teamName = answers.team_name || answers.Team || answers.team || "";
    const teamMembers = (payload as any).team_members as { name: string }[] | undefined;

    // Generate a certificate for each team member
    const names = (teamMembers && teamMembers.length > 0)
      ? teamMembers.map(m => m.name)
      : [payload.name];

    const attachments: Attachment[] = [];
    for (const name of names) {
      let bytes: Uint8Array;
      if (slug.includes("knowbuild")) {
        bytes = await generateKnowbuildCertificatePdf(name, teamName);
      } else {
        bytes = await generateCertificatePdf(name, { eventTitle: payload.event_title });
      }
      attachments.push({
        filename: `${name.replace(/\s+/g, "_")}_Certificate.pdf`,
        content: Buffer.from(bytes),
        contentType: "application/pdf",
      });
    }
    return attachments;
  }

  return undefined;
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

/**
 * Sends a single specific email job by its ID.
 */
export async function sendEmailJob(id: string): Promise<boolean> {
  const { data: job, error: fetchError } = await db
    .from("email_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !job) throw new Error("Job not found");
  if (job.status === "SENT") return true;

  try {
    const payload = job.payload as unknown as TemplatePayload;
    const { subject, html, text } = renderEmail(job.template as TemplateName, payload);
    const attachments = await attachmentsFor(job.template as TemplateName, payload);

    await sendEmail({ to: job.to, subject, html, text, attachments });

    await db
      .from("email_jobs")
      .update({ status: "SENT", sent_at: new Date().toISOString(), last_error: null })
      .eq("id", job.id);

    return true;
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : String(sendError);
    await db
      .from("email_jobs")
      .update({
        status: "FAILED",
        last_error: message.slice(0, 500),
        locked_at: null,
      })
      .eq("id", job.id);
    return false;
  }
}
