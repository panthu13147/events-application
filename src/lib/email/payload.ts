import "server-only";
import { db } from "@/lib/supabase";
import { formatEventDates, formatFee } from "@/lib/events";
import { ticketUrl } from "@/lib/email/queue";
import { getEventFeatures } from "@/config/event-features";
import { getCommunityGroup } from "@/config/community";
import { getSelectionInfo } from "@/config/selection";
import type { TemplatePayload } from "@/lib/email/templates";

/**
 * Snapshots everything the templates need at the moment the job is queued.
 *
 * The payload is stored on the job rather than looked up at send time on
 * purpose: if a venue or time changes between queueing and sending, the email
 * should say what we told the student, not silently disagree with itself.
 */
export async function emailPayload(
  eventId: string,
  name: string,
  code: string,
): Promise<TemplatePayload> {
  const [{ data: event }, { count: dayCount }] = await Promise.all([
    db
      .from("events")
      // `slug` is selected for formatEventDates, not for a link: it's how the
      // formatter knows the dates are a scheduled-TBA placeholder. Without it
      // the confirmation email would print a date the site refuses to show.
      .select("slug, title, starts_at, ends_at, venue, requires_payment, fee_amount")
      .eq("id", eventId)
      .single(),
    db.from("event_days").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);

  const days = dayCount ?? 1;
  const features = event ? getEventFeatures(event.slug) : null;

  return {
    name,
    event_title: event?.title ?? "S4DS event",
    event_dates: event ? formatEventDates(event) : "",
    venue: event?.venue ?? null,
    code,
    ticket_url: ticketUrl(code),
    fee_label: event?.fee_amount ? formatFee(event.fee_amount) : undefined,
    // The deposit comes back on the LAST day's check-in — saying "when you
    // attend" gets read as "when I show up once".
    refund_terms: event?.requires_payment
      ? days > 1
        ? `Your ${formatFee(event.fee_amount)} deposit is refunded in full once you check in on Day ${days}.`
        : `Your ${formatFee(event.fee_amount)} deposit is refunded in full once you check in at the door.`
      : null,
    has_ticket: features?.ticket,
    community: event ? getCommunityGroup(event.slug) : null,
    // Only the "approved" template reads this — harmless on the others.
    selection: event ? getSelectionInfo(event.slug) : null,
  };
}
