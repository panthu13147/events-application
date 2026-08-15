import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reset() {
  console.log("Resetting all registrations and attendance...");
  
  const { error } = await supabase.from("registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Deletes all rows

  if (error) {
    console.error("Failed to delete registrations:", error);
  } else {
    console.log("Successfully wiped all registrations from the DB.");
  }
}

reset();
