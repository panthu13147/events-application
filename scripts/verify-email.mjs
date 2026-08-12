import nodemailer from "nodemailer";

/**
 * Authenticates against Gmail WITHOUT sending anything.
 *
 *   npm run email:verify
 *
 * Run this before an event. A wrong app password or a From that doesn't match
 * the authenticated account fails here, in one second, instead of silently
 * failing 60 times in the queue on the morning of the workshop.
 */

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
const from = process.env.EMAIL_FROM;

if (!user || !pass) {
  console.error("GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env");
  process.exit(1);
}

console.log(`user : ${user}`);
console.log(`from : ${from ?? "(unset — will fall back to GMAIL_USER)"}`);

const fromAddress = from?.match(/<([^>]+)>/)?.[1] ?? from;
if (fromAddress && fromAddress.toLowerCase() !== user.toLowerCase()) {
  console.warn(
    `\nWARNING: EMAIL_FROM (${fromAddress}) is not GMAIL_USER (${user}).\n` +
      "Gmail will rewrite or reject this unless it's a verified 'Send mail as' alias.",
  );
}

try {
  await nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  }).verify();
  console.log("\nSMTP auth OK — credentials work. Nothing was sent.");
} catch (error) {
  console.error("\nSMTP auth FAILED:", error.message);
  console.error(
    "\nUsual causes:\n" +
      "  - App password copied with spaces, or a stale one\n" +
      "  - 2FA not enabled on the account (app passwords require it)\n" +
      "  - Workspace admin has blocked less-secure/SMTP access for the domain",
  );
  process.exit(1);
}
