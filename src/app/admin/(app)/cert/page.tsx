import Link from "next/link";
import { db } from "@/lib/supabase";
import { CertificatesManager } from "./CertificatesManager";
import { EventSelector } from "./EventSelector";

export const dynamic = "force-dynamic";

export const metadata = { title: "Certificates" };

type Params = { searchParams: Promise<{ event?: string }> };

/**
 * Distinct days a person scanned in for. Counted through a Set rather than
 * `attendance.length` so a stray duplicate row can never inflate someone above
 * the number of days the event actually has.
 */
function daysAttended(row: { attendance?: unknown }) {
  const rows = Array.isArray(row.attendance) ? row.attendance : [];
  return new Set(rows.map((a: { event_day_id: string }) => a.event_day_id)).size;
}

export default async function CertificatesPage({ searchParams }: Params) {
  const selectedSlug = (await searchParams).event;

  const { data: events, error: eventsError } = await db
    .from("events")
    .select("id, slug, title")
    .order("starts_at", { ascending: false });

  if (eventsError) throw eventsError;

  const selectedEvent = events?.find((e) => e.slug === selectedSlug) ?? null;

  let registrations: any[] = [];
  let fetchedEventDays: { id: string; label: string | null }[] = [];

  if (selectedEvent) {
    // Get total days for this event
    const { data: eventDays } = await db
      .from("event_days")
      .select("id, label")
      .eq("event_id", selectedEvent.id)
      .order("day_number", { ascending: true });
      
    fetchedEventDays = eventDays || [];

    const { data: regs, error: regsError } = await db
      .from("registrations")
      .select(`
        id, code, full_name, email, phone,
        email_jobs(status, template),
        attendance(id, event_day_id)
      `)
      .eq("event_id", selectedEvent.id)
      .eq("status", "APPROVED")
      .order("created_at", { ascending: true });

    if (regsError) throw regsError;
    
    registrations = (regs ?? []).map(r => {
      const certJobs = Array.isArray(r.email_jobs) 
        ? r.email_jobs.filter((j: any) => j.template === "certificate")
        : (r.email_jobs && (r.email_jobs as any).template === "certificate" ? [r.email_jobs] : []);
        
      let cert_status = "PENDING";
      
      if (certJobs && certJobs.length > 0) {
        // Order by created_at DESC ideally, but just grab the first one
        cert_status = certJobs[0].status;
      }

      // We want to pass the attendance data down so the UI can render individual day columns
      return {
        ...r,
        cert_status,
        attendance: r.attendance || []
      };
    })
    // Whoever turned up most is who you're most likely to be issuing to, so put
    // them at the top. Sorting has to happen here rather than in the query —
    // PostgREST can't order by the size of an embedded relation.
    .sort((a, b) => daysAttended(b) - daysAttended(a) || a.full_name.localeCompare(b.full_name));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
      </div>

      <div className="flex flex-col gap-6">
        <div className="w-full max-w-sm">
          <label htmlFor="event-select" className="mb-2 block text-sm font-medium text-foreground">
            Select Event
          </label>
          <div className="relative">
            <EventSelector events={events || []} selectedSlug={selectedSlug} />
          </div>
        </div>

        {selectedEvent && (
          <CertificatesManager
            event={selectedEvent}
            eventDays={fetchedEventDays}
            registrations={registrations}
          />
        )}
      </div>
    </div>
  );
}
