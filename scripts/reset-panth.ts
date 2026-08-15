import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Fetching Panth's registrations...");
  
  // Update all registrations to the correct email just in case
  await supabase
    .from("registrations")
    .update({ email: "panthu13147@gmail.com" })
    .or("email.eq.panth.shah@somaiya.edu,email.eq.panthu13147@gmail.com");
    
  const { data: registrations, error: regError } = await supabase
    .from("registrations")
    .select("id")
    .eq("email", "panthu13147@gmail.com");
    
  if (regError) {
    console.error("Error fetching registrations:", regError);
    return;
  }
  
  const regIds = registrations.map(r => r.id);
  console.log(`Found ${regIds.length} registrations. Deleting their certificate jobs...`);

  if (regIds.length > 0) {
    const { data: deleteData, error: deleteError } = await supabase
      .from("certificate_jobs")
      .delete()
      .in("registration_id", regIds);

    if (deleteError) {
      console.error("Error deleting certificate jobs:", deleteError);
    } else {
      console.log("Successfully deleted certificate jobs. You can now test sending from the UI again!");
    }
  }
}

main();
