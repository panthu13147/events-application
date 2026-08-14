/**
 * Runs the certificate worker once against the local dev server.
 *
 *   npm run cert:work
 */

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET must be set in .env");
  process.exit(1);
}

const response = await fetch(`${base}/api/cron/process-certificates`, {
  method: "POST",
  headers: { "x-cron-secret": secret },
});

const body = await response.text();
console.log(`${response.status} ${body}`);

if (!response.ok) process.exit(1);

const { processed, success, failed } = JSON.parse(body);
if (processed === 0) console.log("Queue is empty.");
if (failed) console.log(`${failed} failed — check the dev server log for the reason.`);
if (success) console.log(`${success} sent. Run again if more are queued.`);
