/**
 * What each event does and doesn't do, keyed by `Event.slug`.
 *
 * These started as one-line Sets in three separate files — a schedule list, an
 * email list, and nearly a ticket list. All keyed by the same slug, all
 * answering the same question. That shape drifts: someone adds an event to two
 * of the three, and the one they missed is silent rather than wrong, which is
 * the hardest kind of bug to notice. One record per event makes an omission
 * visible at a glance.
 *
 * These are CODE, not columns, for the same reason the form and speaker
 * registries are: they change once per event and are easier to review in a diff
 * than in a table. The database still holds everything that varies per
 * registration.
 */

export type EventFeatures = {
  /**
   * Dates aren't fixed yet. `events.starts_at` / `ends_at` are NOT NULL, so the
   * row carries placeholders — this is what stops the site presenting them as
   * fact. A wrong date on a public page is worse than no date: people plan
   * around it, and the correction never reaches everyone who saw it.
   *
   * Set back to false the moment the dates are confirmed. The placeholder does
   * not stop being a placeholder on its own, it just stops being hidden.
   */
  scheduleTba: boolean;

  /**
   * Send email at any stage: confirmation, waitlisted, approved, rejected,
   * ticket resend, certificates.
   *
   * False is a hard block enforced at ENQUEUE (see `enqueueEmail`), not at
   * send. A queued-then-skipped job leaves a row that looks like a stuck email,
   * and the first person to see a backlog in /admin/emails will quite
   * reasonably try to flush it. Never writing the row is the only version that
   * can't be undone by a well-meaning click.
   *
   * The cost: registrants get NO paper trail. Losing their link means an admin
   * looking them up by name. Anything time-sensitive has to reach them another
   * way — see `@/config/community`.
   */
  email: boolean;

  /**
   * Issue a scannable ticket with a QR code.
   *
   * False means /t/<code> becomes a plain confirmation page: no QR, no stub,
   * no per-day check-in list. The registration still gets a `code` and a
   * `qr_token` — they're NOT NULL and the code is how an admin finds someone —
   * the token simply never becomes a QR anybody can scan.
   *
   * Turning this off means there is no door check. Attendance for the event
   * will be empty, so anything downstream that reads attendance (certificates,
   * "who actually showed up") has nothing to work from.
   */
  ticket: boolean;
};

/** What an event does unless it says otherwise. */
const DEFAULTS: EventFeatures = {
  scheduleTba: false,
  email: true,
  ticket: true,
};

const OVERRIDES: Record<string, Partial<EventFeatures>> = {
  "mahakumbh-hackathon": {
    // Date is confirmed (9 Sep 2026); duration and venue are still undecided.
    scheduleTba: false,
    // No email at any stage, by request. The WhatsApp group is the channel.
    email: false,
    // No ticket and no QR — registering, and the group link, is the whole flow.
    ticket: false,
  },
  "knowbuild-2-0": {
    // Teams are reviewed by hand (auto_approve: false) — no QR is issued at
    // any stage, by request. The WhatsApp group (src/config/community) is
    // what people are pointed at instead, on the ticket page and in email.
    ticket: false,
  },
};

export function getEventFeatures(slug: string): EventFeatures {
  return { ...DEFAULTS, ...OVERRIDES[slug] };
}

/** Shown wherever a date would otherwise go. */
export const SCHEDULE_TBA_LABEL = "Dates to be announced";
