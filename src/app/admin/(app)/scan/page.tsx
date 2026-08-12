import { db } from "@/lib/supabase";
import { formatDayDate, scannableSince } from "@/lib/events";
import { ScannerClient } from "./ScannerClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Scanner" };

export default async function ScanPage() {
  // Only days from events that haven't finished — a volunteer should never be
  // able to pick last semester's workshop by mistake.
  const { data: events, error } = await db
    .from("events")
    .select("id, title, ends_at")
    .eq("status", "PUBLISHED")
    .gte("ends_at", scannableSince())
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const eventIds = (events ?? []).map((event) => event.id);

  const { data: dayRows } = eventIds.length
    ? await db
        .from("event_days")
        .select("id, event_id, day_number, label, date")
        .in("event_id", eventIds)
        .order("day_number", { ascending: true })
    : { data: [] };

  const titles = new Map((events ?? []).map((event) => [event.id, event.title]));

  const days = (dayRows ?? []).map((day) => ({
    id: day.id,
    label: `${day.label ?? `Day ${day.day_number}`} · ${formatDayDate(day.date)}`,
    event_title: titles.get(day.event_id) ?? "",
  }));

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scanner</h1>
        <p className="text-sm text-muted-foreground">
          Point the camera at a ticket QR. Green means let them in.
        </p>
      </div>

      <ScannerClient days={days} />
    </div>
  );
}
