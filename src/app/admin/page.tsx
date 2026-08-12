import Link from "next/link";
import { db } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

/**
 * PHASE 0 PLACEHOLDER — Track A replaces this with the real events dashboard.
 *
 * It exists to prove the whole chain works end to end: Supabase connection,
 * service-role access through RLS, session cookie, proxy, and seeded data.
 */
export default async function AdminHome() {
  const [eventsResult, daysResult, registrationsResult] = await Promise.all([
    db.from("events").select("*").order("starts_at", { ascending: false }),
    db.from("event_days").select("event_id"),
    // Fine for a placeholder against seeded data. Track A should replace this
    // with a proper aggregate rather than counting rows in JS.
    db.from("registrations").select("event_id"),
  ]);

  for (const result of [eventsResult, daysResult, registrationsResult]) {
    if (result.error) throw result.error;
  }

  const events = eventsResult.data ?? [];

  const tally = (rows: { event_id: string }[]) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.event_id] = (acc[row.event_id] ?? 0) + 1;
      return acc;
    }, {});

  const dayCount = tally(daysResult.data ?? []);
  const regCount = tally(registrationsResult.data ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground">
          Phase 0 placeholder — Track A builds the real dashboard here.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No events yet. Run <code className="font-mono">npm run db:seed</code>.
        </p>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Link href={`/${event.slug}`} className="font-medium hover:underline">
                      {event.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">/{event.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={event.status === "PUBLISHED" ? "default" : "secondary"}>
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dayCount[event.id] ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {regCount[event.id] ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {event.capacity ?? "∞"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
