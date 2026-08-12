import "server-only";
import { db, isUniqueViolation } from "@/lib/supabase";

/**
 * Core check-in logic, shared by the QR route and the manual by-code fallback.
 *
 * Response shapes are part of the API contract (docs/ARCHITECTURE.md) — the
 * scanner UI switches on `result`, so don't add a case without updating both.
 */

export type ScanOutcome =
  | { status: 200; body: { result: "OK"; name: string; code: string; day_label: string } }
  | { status: 409; body: { result: "DUPLICATE"; name: string; scanned_at: string | null } }
  | { status: 404; body: { result: "NOT_FOUND" } }
  | { status: 403; body: { result: "NOT_APPROVED"; name: string; status: string } }
  | { status: 403; body: { result: "WRONG_EVENT"; name: string; event_title: string } };

type Lookup = { by: "qr_token" | "code"; value: string };

export async function checkIn(
  lookup: Lookup,
  eventDayId: string,
  scannedBy: string,
): Promise<ScanOutcome> {
  const { data: day, error: dayError } = await db
    .from("event_days")
    .select("id, event_id, day_number, label")
    .eq("id", eventDayId)
    .maybeSingle();

  if (dayError) throw dayError;
  if (!day) return { status: 404, body: { result: "NOT_FOUND" } };

  const { data: registration, error } = await db
    .from("registrations")
    .select("id, code, full_name, status, event_id")
    .eq(lookup.by, lookup.value)
    .maybeSingle();

  if (error) throw error;
  if (!registration) return { status: 404, body: { result: "NOT_FOUND" } };

  // A real ticket for a different event. Worth its own message — at a venue
  // running back-to-back events this is a common and confusing mistake.
  if (registration.event_id !== day.event_id) {
    const { data: theirEvent } = await db
      .from("events")
      .select("title")
      .eq("id", registration.event_id)
      .maybeSingle();

    return {
      status: 403,
      body: {
        result: "WRONG_EVENT",
        name: registration.full_name,
        event_title: theirEvent?.title ?? "another event",
      },
    };
  }

  if (registration.status !== "APPROVED") {
    return {
      status: 403,
      body: { result: "NOT_APPROVED", name: registration.full_name, status: registration.status },
    };
  }

  const { error: insertError } = await db
    .from("attendance")
    .insert({ registration_id: registration.id, event_day_id: day.id, scanned_by: scannedBy });

  if (insertError) {
    // The unique (registration_id, event_day_id) constraint is what prevents
    // double check-ins. We let the database decide rather than checking first,
    // which would race between two volunteers scanning at the same moment.
    if (isUniqueViolation(insertError)) {
      const { data: existing } = await db
        .from("attendance")
        .select("scanned_at")
        .eq("registration_id", registration.id)
        .eq("event_day_id", day.id)
        .maybeSingle();

      return {
        status: 409,
        body: {
          result: "DUPLICATE",
          name: registration.full_name,
          scanned_at: existing?.scanned_at ?? null,
        },
      };
    }
    throw insertError;
  }

  return {
    status: 200,
    body: {
      result: "OK",
      name: registration.full_name,
      code: registration.code,
      day_label: day.label ?? `Day ${day.day_number}`,
    },
  };
}
