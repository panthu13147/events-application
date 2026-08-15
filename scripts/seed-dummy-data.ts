import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Seeding dummy data for LLM Masterclass...");

  // Get the LLM Masterclass event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("slug", "llm-masterclass")
    .single();

  if (eventError || !event) {
    console.error("Could not find LLM Masterclass event:", eventError);
    return;
  }

  // Get event days for LLM Masterclass
  const { data: eventDays } = await supabase
    .from("event_days")
    .select("id, day_number")
    .eq("event_id", event.id);

  if (!eventDays || eventDays.length === 0) {
    console.error("No event days found for LLM Masterclass.");
    return;
  }

  // Generate 3 dummy users
  const dummyUsers = [
    { name: "Alice Hacker", email: "alice@example.com" },
    { name: "Bob Builder", email: "bob@example.com" },
    { name: "Charlie Chaplin", email: "charlie@example.com" }
  ];

  for (let i = 0; i < dummyUsers.length; i++) {
    const user = dummyUsers[i];
    console.log(`\nProcessing ${user.name}...`);
    
    // Register the user using the RPC function (handles capacity, unique codes, etc.)
    const code = `DUMMY-${i + 1}`;
    const qrToken = crypto.randomBytes(32).toString("hex");

    const { data: reg, error: regError } = await supabase.rpc("register_for_event", {
      p_event_id: event.id,
      p_code: code,
      p_qr_token: qrToken,
      p_full_name: user.name,
      p_email: user.email,
      p_phone: "9876543210",
      p_answers: {}
    });

    if (regError && !regError.message.includes("DUPLICATE_EMAIL")) {
      console.error(`Error registering ${user.name}:`, regError);
      continue;
    }

    // Fetch the registration ID to add attendance
    const { data: fetchReg } = await supabase
      .from("registrations")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!fetchReg) continue;

    // Approve the user
    await supabase
      .from("registrations")
      .update({ status: "APPROVED" })
      .eq("id", fetchReg.id);

    // Make Alice attend ALL days
    // Make Bob attend ONLY DAY 1
    // Make Charlie attend NO days
    if (i === 0) {
      console.log(`Marking Alice as attended for all ${eventDays.length} days...`);
      for (const day of eventDays) {
        await supabase.from("attendance").insert({
          registration_id: fetchReg.id,
          event_day_id: day.id
        }).select().maybeSingle();
      }
    } else if (i === 1 && eventDays.length > 0) {
      console.log(`Marking Bob as attended for Day 1 only...`);
      await supabase.from("attendance").insert({
        registration_id: fetchReg.id,
        event_day_id: eventDays[0].id
      }).select().maybeSingle();
    } else {
      console.log(`Charlie did not attend any days.`);
    }
  }

  console.log("\nDummy data seeding complete!");
}

main();
