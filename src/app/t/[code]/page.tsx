import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/supabase";
import { formatDayDate, formatEventDates } from "@/lib/events";
import { TicketQR } from "./TicketQR";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your ticket — S4DS KJSIT" };

export default async function TicketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: registration, error } = await db
    .from("registrations")
    .select("id, code, qr_token, full_name, status, event_id")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!registration) notFound();

  const [{ data: event }, { data: days }, { data: attendance }] = await Promise.all([
    db.from("events").select("*").eq("id", registration.event_id).single(),
    db
      .from("event_days")
      .select("*")
      .eq("event_id", registration.event_id)
      .order("day_number", { ascending: true }),
    db.from("attendance").select("event_day_id").eq("registration_id", registration.id),
  ]);

  if (!event) notFound();

  const attended = new Set((attendance ?? []).map((row) => row.event_day_id));
  const pending = registration.status === "PENDING";
  const rejected = registration.status === "REJECTED" || registration.status === "CANCELLED";

  return (
    <main className="mx-auto max-w-md px-5 py-10 sm:py-16">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="space-y-1 border-b p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">S4DS · KJSIT</p>
          <h1 className="text-xl font-semibold tracking-tight">{event.title}</h1>
          <p className="text-sm text-muted-foreground">{formatEventDates(event)}</p>
          {event.venue ? <p className="text-sm text-muted-foreground">{event.venue}</p> : null}
        </div>

        <div className="flex flex-col items-center gap-4 p-6">
          {rejected ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
              This registration is no longer valid. Talk to the organisers if you think that&apos;s
              a mistake.
            </div>
          ) : (
            <>
              <TicketQR token={registration.qr_token} />
              {pending ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-700 dark:text-amber-400">
                  <strong className="font-medium">Awaiting approval.</strong> An organiser is
                  checking your payment. Keep this link — the QR starts working once approved.
                </p>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Show this at the door on each day.
                </p>
              )}
            </>
          )}

          <div className="w-full space-y-1 border-t pt-4 text-center">
            <p className="text-lg font-medium">{registration.full_name}</p>
            <p className="font-mono text-sm tracking-wider text-muted-foreground">
              {registration.code}
            </p>
          </div>
        </div>

        {days && days.length > 0 ? (
          <ul className="border-t">
            {days.map((day) => (
              <li
                key={day.id}
                className="flex items-center justify-between gap-3 border-b px-6 py-3 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-medium">{day.label ?? `Day ${day.day_number}`}</p>
                  <p className="text-xs text-muted-foreground">{formatDayDate(day.date)}</p>
                </div>
                {attended.has(day.id) ? (
                  <Badge>Checked in</Badge>
                ) : (
                  <Badge variant="outline">Not yet</Badge>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Bookmark this page — it&apos;s your ticket.{" "}
        <Link href={`/${event.slug}`} className="underline underline-offset-4">
          Event details
        </Link>
      </p>
    </main>
  );
}
