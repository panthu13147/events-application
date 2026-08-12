/**
 * Scheduled every minute by netlify.toml.
 *
 * It does nothing itself — it just pokes the route handler, so all the queue
 * logic lives in normal Next.js code that Track D can run and test locally.
 *
 * TODO(Track D): implement /api/cron/process-emails.
 */
export default async function handler() {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!base || !process.env.CRON_SECRET) {
    console.error("process-emails: URL or CRON_SECRET not configured");
    return new Response("not configured", { status: 500 });
  }

  const response = await fetch(`${base}/api/cron/process-emails`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET },
  });

  const body = await response.text();
  console.log(`process-emails: ${response.status} ${body}`);

  return new Response(body, { status: response.status });
}
