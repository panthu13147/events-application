import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN");

    const body = await request.json();
    const { eventId, attendees } = body;

    if (!eventId || !Array.isArray(attendees)) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    // 1. Fetch event days to mark attendance
    const { data: eventDays } = await db
      .from("event_days")
      .select("id")
      .eq("event_id", eventId);

    let createdCount = 0;

    // Process sequentially (or batch) - sequentially is fine for small CSVs
    for (const attendee of attendees) {
      if (!attendee.email || !attendee.full_name) continue;

      // Create a unique random token/code just like the normal registration flow
      const code = "CSV-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const qr_token = crypto.randomUUID().replace(/-/g, "");

      // Upsert the registration (in case they re-upload the same email)
      const { data: reg, error: regError } = await db
        .from("registrations")
        .upsert({
          event_id: eventId,
          email: attendee.email,
          full_name: attendee.full_name,
          code,
          qr_token,
          status: "APPROVED",
        }, { onConflict: "event_id,email" })
        .select("id")
        .single();

      if (regError) {
        console.error("Failed to insert registration from CSV:", regError);
        continue;
      }

      // Mark attendance for all event days so they become eligible
      if (reg && eventDays && eventDays.length > 0) {
        const attendanceData = eventDays.map(day => ({
          registration_id: reg.id,
          event_day_id: day.id,
          scanned_by: "CSV_UPLOAD"
        }));

        await db
          .from("attendance")
          .upsert(attendanceData, { onConflict: "registration_id,event_day_id" });
      }

      createdCount++;
    }

    return NextResponse.json({ success: true, createdCount });
  } catch (error: any) {
    console.error("CSV upload error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
