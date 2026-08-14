import Link from "next/link";
import { db } from "@/lib/supabase";
import { CertificatesManager } from "./CertificatesManager";
import { EventSelector } from "./EventSelector";
import { CsvUpload } from "./CsvUpload";

export const dynamic = "force-dynamic";

export const metadata = { title: "Certificates" };

type Params = { searchParams: Promise<{ event?: string }> };

export default async function CertificatesPage({ searchParams }: Params) {
  const selectedSlug = (await searchParams).event;

  const { data: events, error: eventsError } = await db
    .from("events")
    .select("id, slug, title")
    .order("starts_at", { ascending: false });

  if (eventsError) throw eventsError;

  const selectedEvent = events?.find((e) => e.slug === selectedSlug) ?? null;

  let registrations = [];
  if (selectedEvent) {
    // Get total days for this event
    const { data: eventDays } = await db
      .from("event_days")
      .select("id")
      .eq("event_id", selectedEvent.id);
      
    const totalDays = eventDays?.length || 0;

    const { data: regs, error: regsError } = await db
      .from("registrations")
      .select(`
        id, code, full_name, email, phone,
        certificate_jobs(status),
        attendance(id)
      `)
      .eq("event_id", selectedEvent.id)
      .eq("status", "APPROVED")
      .order("created_at", { ascending: true });

    if (regsError) throw regsError;
    
    // Filter out users who haven't attended all days (if there are days)
    // For CSV uploads, if totalDays === 0, everyone is eligible.
    registrations = (regs ?? []).filter(r => {
      // If the event has defined days, attendees MUST have scanned in for all of them
      if (totalDays > 0) {
        // @ts-ignore
        const attendanceCount = r.attendance?.length || 0;
        return attendanceCount >= totalDays;
      }
      return true; // No days defined = everyone approved is eligible
    }).map(r => {
      // @ts-ignore
      const certJobs = r.certificate_jobs;
      let cert_status = "PENDING";
      
      if (Array.isArray(certJobs) && certJobs.length > 0) {
        // Order by created_at DESC ideally, but just grab the first one
        cert_status = certJobs[0].status;
      } else if (certJobs && !Array.isArray(certJobs)) {
        cert_status = (certJobs as any).status;
      }

      return {
        ...r,
        cert_status
      };
    });
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
          <>
            <CsvUpload eventId={selectedEvent.id} />
            <CertificatesManager
              event={selectedEvent}
              registrations={registrations}
            />
          </>
        )}
      </div>
    </div>
  );
}
