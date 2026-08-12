import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { db } from "@/lib/supabase";
import { formatEventDates } from "@/lib/events";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Events" };

export default async function AdminHome() {
  const [eventsResult, daysResult, registrationsResult] = await Promise.all([
    db.from("events").select("*").order("starts_at", { ascending: false }),
    db.from("event_days").select("event_id"),
    db.from("registrations").select("event_id, status"),
  ]);

  for (const result of [eventsResult, daysResult, registrationsResult]) {
    if (result.error) throw result.error;
  }

  const events = eventsResult.data ?? [];

  const dayCount = (daysResult.data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.event_id] = (acc[row.event_id] ?? 0) + 1;
    return acc;
  }, {});

  // Pending is the number that decides whether you need to do something today,
  // so it gets its own count rather than being buried in the total.
  const stats = (registrationsResult.data ?? []).reduce<
    Record<string, { total: number; pending: number }>
  >((acc, row) => {
    const entry = (acc[row.event_id] ??= { total: 0, pending: 0 });
    entry.total += 1;
    if (row.status === "PENDING") entry.pending += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground">
          Open an event to review and approve its registrations.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No events yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const stat = stats[event.id] ?? { total: 0, pending: 0 };

            return (
              <li key={event.id} className="relative rounded-xl border bg-card">
                <Link
                  href={`/admin/events/${event.slug}`}
                  className="flex items-center gap-4 p-4 pr-14 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{event.title}</span>
                      <Badge variant={event.status === "PUBLISHED" ? "default" : "secondary"}>
                        {event.status}
                      </Badge>
                      {stat.pending > 0 ? (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                          {stat.pending} to review
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {formatEventDates(event)} · {dayCount[event.id] ?? 0}{" "}
                      {dayCount[event.id] === 1 ? "day" : "days"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tabular-nums font-medium">
                      {stat.total}
                      {event.capacity ? (
                        <span className="text-muted-foreground">/{event.capacity}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">registered</p>
                  </div>

                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>

                {/* Outside the Link — nesting anchors is invalid HTML and the
                    inner one stops working. */}
                <a
                  href={`/${event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open the public event page"
                  aria-label={`Open the public page for ${event.title} in a new tab`}
                  className="absolute right-11 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink className="size-4" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
