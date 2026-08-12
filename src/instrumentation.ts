/**
 * Dev-only email worker.
 *
 * In production Netlify runs a scheduled function every minute, so queued mail
 * sends itself. On localhost there is no scheduler, which made registering look
 * like "the email never sent" when it was really just sitting in the queue.
 *
 * This runs the same drain loop in the dev server so local behaves like prod.
 */
export async function register() {
  // instrumentation also loads in the edge runtime, where none of this works.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development") return;

  const { processEmailQueue } = await import("@/lib/email/worker");

  const INTERVAL_MS = 15_000;
  let running = false;

  setInterval(async () => {
    // A slow SMTP round trip must not stack up overlapping drains.
    if (running) return;
    running = true;

    try {
      const { sent, failed } = await processEmailQueue(5);
      if (sent || failed) {
        console.log(`[email] sent ${sent}, failed ${failed}`);
      }
    } catch (error) {
      // Never crash the dev server over this — a missing Gmail password
      // shouldn't stop someone working on the registration form.
      console.error("[email] drain failed:", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  }, INTERVAL_MS).unref?.();

  console.log(`[email] dev worker on — draining the queue every ${INTERVAL_MS / 1000}s`);
}
