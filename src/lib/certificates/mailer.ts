import "server-only";
import { sendEmail } from "@/lib/email/send";

export async function sendCertificateEmail(opts: {
  to: string;
  participantName: string;
  eventName: string;
  pdfBytes: Uint8Array;
}) {
  await sendEmail({
    to: opts.to,
    subject: `Your certificate — ${opts.eventName}`,
    text: `Hi ${opts.participantName},\n\nThanks for participating in ${opts.eventName}. Your certificate is attached.\n\n— S4DS KJSIT`,
    html: `<p>Hi ${opts.participantName},</p><p>Thanks for participating in ${opts.eventName}. Your certificate is attached.</p><p>— S4DS KJSIT</p>`,
    attachments: [
      {
        filename: `certificate-${opts.participantName.replace(/\s+/g, "_")}.pdf`,
        content: Buffer.from(opts.pdfBytes),
      },
    ],
  });
}
