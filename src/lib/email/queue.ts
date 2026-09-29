import "server-only";
import { db } from "@/lib/supabase";
import { getEventFeatures } from "@/config/event-features";
import type { TemplateName, TemplatePayload } from "@/lib/email/templates";
import type { Json } from "@/lib/database.types";

/**
 * Is this event allowed to send email at all?
 *
 * Exported so callers that write to `email_jobs` directly rather than through
 * `enqueueEmail` (the bulk certificate route) can run the same check against
 * the same list.
 */
export async function eventSendsEmail(eventId: string): Promise<boolean> {
  const { data, error } = await db
    .from("events")
    .select("slug")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    // Fail CLOSED. "No email policy" is a promise made to the people running
    // the event; sending anyway because a lookup blipped is the one outcome
    // that can't be walked back once it's in someone's inbox.
    console.error("eventSendsEmail lookup failed, suppressing:", error, eventId);
    return false;
  }

  return data ? getEventFeatures(data.slug).email : false;
}

/**
 * The only email function the rest of the app calls.
 *
 * Nothing is ever sent inside a request. Registration writes a row here and
 * returns immediately, so a slow or rate-limited Gmail can never make a student
 * sit staring at a spinner — or worse, fail their registration.
 *
 * A Netlify scheduled function drains the queue a few jobs at a time.
 *
 * `event_id` is REQUIRED, and only so that the no-email check below cannot be
 * skipped. Making it optional would mean every new caller is one forgotten
 * argument away from mailing an event that promised silence — the type system
 * is a better guard than a comment asking people to remember.
 */
export async function enqueueEmail(job: {
  to: string;
  template: TemplateName;
  payload: TemplatePayload;
  event_id: string;
  registration_id?: string;
}): Promise<void> {
  if (!(await eventSendsEmail(job.event_id))) {
    // Deliberately quiet: for a no-email event this is the normal path, not a
    // problem, and a warning per registration would train people to ignore it.
    return;
  }

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
