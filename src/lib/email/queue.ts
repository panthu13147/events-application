import "server-only";
import { db } from "@/lib/supabase";
import type { TemplateName, TemplatePayload } from "@/lib/email/templates";
import type { Json } from "@/lib/database.types";

/**
 * The only email function the rest of the app calls.
 *
 * Nothing is ever sent inside a request. Registration writes a row here and
 * returns immediately, so a slow or rate-limited Gmail can never make a student
 * sit staring at a spinner — or worse, fail their registration.
 *
 * A Netlify scheduled function drains the queue a few jobs at a time.
 */
export async function enqueueEmail(job: {
  to: string;
  template: TemplateName;
  payload: TemplatePayload;
  registration_id?: string;
}): Promise<void> {
  const { error } = await db.from("email_jobs").insert({
    to: job.to.toLowerCase(),
    template: job.template,
    payload: job.payload as unknown as Json,
    registration_id: job.registration_id ?? null,
  });

  if (error) {
    // Never fail the caller's request over this. A student who registered
    // successfully but didn't get an email is recoverable; a 500 on the
    // registration form is not.
    console.error("enqueueEmail failed:", error, job.template, job.to);
  }
}

/** Builds the absolute ticket URL used in every template. */
export function ticketUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/t/${code}`;
}
