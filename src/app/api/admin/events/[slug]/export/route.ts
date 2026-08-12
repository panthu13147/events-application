import { db } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/auth";
import { getFormFields } from "@/config/forms";

/**
 * CSV export of everyone registered for an event.
 *
 * Includes a column per form-registry question and a column per event day, so
 * the file is enough on its own to work out who turned up and who is
 * certificate-eligible without opening the app.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { slug } = await params;

  const { data: event, error: eventError } = await db
    .from("events")
    .select("id, slug, title, form_key")
    .eq("slug", slug)
    .maybeSingle();

  if (eventError) throw eventError;
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const [{ data: days }, { data: registrations }] = await Promise.all([
    db
      .from("event_days")
      .select("id, day_number, label")
      .eq("event_id", event.id)
      .order("day_number", { ascending: true }),
    db
      .from("registrations")
      .select("id, code, full_name, email, phone, status, answers, payment_proof_url, created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true }),
  ]);

  const registrationIds = (registrations ?? []).map((row) => row.id);

  const { data: attendance } = registrationIds.length
    ? await db
        .from("attendance")
        .select("registration_id, event_day_id, scanned_at")
        .in("registration_id", registrationIds)
    : { data: [] };

  const attended = new Set(
    (attendance ?? []).map((row) => `${row.registration_id}:${row.event_day_id}`),
  );

  const fields = getFormFields(event.form_key);
  const dayList = days ?? [];

  const header = [
    "code",
    "status",
    "full_name",
    "email",
    "phone",
    ...fields.map((field) => field.key),
    ...dayList.map((day) => day.label ?? `Day ${day.day_number}`),
    "days_attended",
    "payment_proof_uploaded",
    "registered_at",
  ];

  const rows = (registrations ?? []).map((row) => {
    const answers = (row.answers ?? {}) as Record<string, unknown>;
    const perDay = dayList.map((day) => (attended.has(`${row.id}:${day.id}`) ? "yes" : "no"));

    return [
      row.code,
      row.status,
      row.full_name,
      row.email,
      row.phone ?? "",
      ...fields.map((field) => String(answers[field.key] ?? "")),
      ...perDay,
      String(perDay.filter((value) => value === "yes").length),
      // The proof itself is only viewable in the admin UI — signed Cloudinary
      // URLs expire, so putting one in a CSV would be dead on arrival.
      row.payment_proof_url ? "yes" : "no",
      row.created_at,
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-registrations.csv"`,
      // Never let a proxy or the browser cache a list of students' contact details.
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Quote anything that could break the row, and neutralise formula injection —
 * a cell starting with =, +, - or @ is executed by Excel when the file is
 * opened, and these values come from a public form.
 */
function escapeCell(value: string): string {
  const cell = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}
