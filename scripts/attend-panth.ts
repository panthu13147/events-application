import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Making Panth eligible for all certificates...");
  
  // 1. Get Panth's registrations
  const { data: registrations, error: regError } = await supabase
    .from("registrations")
    .select("id, event_id")
    .eq("email", "panthu13147@gmail.com");
    
  if (regError || !registrations) {
    console.error("Error fetching registrations:", regError);
    return;
  }
  
  let totalAttendanceAdded = 0;

  for (const reg of registrations) {
    // 2. Get the event days for this event
    const { data: eventDays } = await supabase
      .from("event_days")
      .select("id")
      .eq("event_id", reg.event_id);
      
    if (!eventDays || eventDays.length === 0) continue;
    
    // 3. Mark attendance
    const attendanceData = eventDays.map(day => ({
      registration_id: reg.id,
      event_day_id: day.id,
      scanned_by: "AUTO_TEST_SCRIPT"
    }));
    
    const { error: attError } = await supabase
      .from("attendance")
      .upsert(attendanceData, { onConflict: "registration_id,event_day_id" });
      
    if (attError) {
      console.error("Error marking attendance:", attError);
    } else {
      totalAttendanceAdded += attendanceData.length;
    }
  }
  
  console.log(`Success! Marked ${totalAttendanceAdded} days of attendance for Panth across ${registrations.length} events.`);
}

main();
