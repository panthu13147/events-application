import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * The ONLY file that knows we use Gmail.
 *
 * Everything else calls enqueueEmail() and never touches this. Swapping to
 * Brevo, Resend or anything else is a change to this file alone.
 */

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  /** Always provide one. A missing plain-text part hurts spam placement. */
  text: string;
  /**
   * `cid` turns an attachment into an inline image the HTML can reference; the
   * QR and the WhatsApp mark use it. `contentType` is for the ones that stay
   * attachments, like the certificate PDF. Content is a Buffer because that is
   * what nodemailer's own types accept — callers holding a Uint8Array (pdf-lib
   * returns one) wrap it in Buffer.from() rather than widening this.
   */
  attachments?: {
    filename: string;
    content: Buffer;
    cid?: string;
    contentType?: string;
  }[];
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  // Google shows app passwords as "abcd efgh ijkl mnop" — people paste the
  // spaces, and SMTP auth fails with a confusing error.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!user || !pass) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set.");
  }

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendEmail({ to, subject, html, text, attachments }: SendArgs) {
  // Gmail rewrites or rejects a From that isn't the authenticated account, so
  // fall back to GMAIL_USER rather than sending something that looks forged.
  const from = process.env.EMAIL_FROM ?? process.env.GMAIL_USER!;

  await getTransporter().sendMail({ from, to, subject, html, text, attachments });
}

/** Authenticates against Gmail without sending anything. */
export async function verifyEmailCredentials(): Promise<true> {
  await getTransporter().verify();
  return true;
}
