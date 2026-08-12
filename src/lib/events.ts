import "server-only";
import { db } from "@/lib/supabase";
import { getFormFields } from "@/config/forms";
import type { Event, EventDay } from "@/lib/database.types";

/**
 * Shared event queries. "Now" is always computed on the server — students'
 * device clocks disagree, and a wrong clock must never open a closed form.
 */

export type EventWithDays = Event & {
  days: EventDay[];
  spots_left: number | null;
  registration_open: boolean;
  /** Full — new registrations join the waitlist instead of taking a seat. */
  waitlisting: boolean;
};

/**
 * Only PENDING and APPROVED hold a seat.
 *
 * WAITLISTED deliberately does not, which is what lets rejecting or deleting an
 * approved registration genuinely free one up for promotion. Kept in sync with
 * register_for_event() in supabase/migrations/0004_waitlist.sql — if you change
 * one, change the other or the page will disagree with the database.
 */
async function takenSpots(eventId: string): Promise<number> {
  const { count, error } = await db
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["PENDING", "APPROVED"]);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Being full no longer closes registration — it switches to a waitlist. Only
 * the publish status and the date window close it.
 */
export function isRegistrationOpen(event: Event, _spotsLeft: number | null, now = new Date()) {
  if (event.status !== "PUBLISHED") return false;
  if (event.registration_opens_at && now < new Date(event.registration_opens_at)) return false;
  if (event.registration_closes_at && now > new Date(event.registration_closes_at)) return false;
  return true;
}

export async function getEventBySlug(slug: string): Promise<EventWithDays | null> {
  const { data: event, error } = await db
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();

  if (error) throw error;
  if (!event) return null;

  const { data: days, error: daysError } = await db
    .from("event_days")
    .select("*")
    .eq("event_id", event.id)
    .order("day_number", { ascending: true });

  if (daysError) throw daysError;

  const spots_left =
    event.capacity === null ? null : Math.max(0, event.capacity - (await takenSpots(event.id)));

  return {
    ...event,
    days: days ?? [],
    spots_left,
    registration_open: isRegistrationOpen(event, spots_left),
    waitlisting: spots_left !== null && spots_left <= 0,
  };
}

/** The event page needs the questions too — resolved from the code registry. */
export function getEventFormFields(event: Pick<Event, "form_key">) {
  return getFormFields(event.form_key);
}

export type HomepageEvents = {
  open: Event[];
  upcoming: Event[];
  past: Event[];
};

export async function getHomepageEvents(): Promise<HomepageEvents> {
  const now = new Date();

  const { data: events, error } = await db
    .from("events")
    .select("*")
    .eq("status", "PUBLISHED")
    .order("starts_at", { ascending: true });

  if (error) throw error;

  // Capacity is only needed to decide "open vs upcoming", so only count for
  // events that could still be open.
  const counts = new Map<string, number>();
  await Promise.all(
    (events ?? [])
      .filter((event) => event.capacity !== null && new Date(event.ends_at) >= now)
      .map(async (event) => counts.set(event.id, await takenSpots(event.id))),
  );

  const result: HomepageEvents = { open: [], upcoming: [], past: [] };

  for (const event of events ?? []) {
    if (new Date(event.ends_at) < now) {
      result.past.push(event);
      continue;
    }

    const spotsLeft =
      event.capacity === null ? null : Math.max(0, event.capacity - (counts.get(event.id) ?? 0));

    if (isRegistrationOpen(event, spotsLeft, now)) {
      result.open.push(event);
    } else {
      result.upcoming.push(event);
    }
  }

  // Most recent first reads better for a list of things that already happened.
  result.past.reverse();
  return result;
}

/**
 * Events the scanner should still offer: anything that hasn't finished, plus a
 * day of slack so a late-running event stays scannable past midnight.
 */
export function scannableSince(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

/** 10000 -> "₹100" */
export function formatFee(paise: number | null): string {
  if (!paise) return "Free";
  const rupees = paise / 100;
  return `₹${rupees % 1 === 0 ? rupees.toFixed(0) : rupees.toFixed(2)}`;
}

const IST = "Asia/Kolkata";

export function formatEventDates(event: Pick<Event, "starts_at" | "ends_at">): string {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);

  const day = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: IST });
  const time = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST });

  const sameDay = day(start) === day(end);
  return sameDay
    ? `${day(start)} · ${time(start)} – ${time(end)}`
    : `${day(start)} – ${day(end)} · ${time(start)} – ${time(end)}`;
}

export function formatDayDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: IST,
  });
}
