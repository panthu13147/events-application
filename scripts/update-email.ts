import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from("registrations")
    .update({ email: "panthu13147@gmail.com" })
    .eq("email", "panth.shah@somaiya.edu");

  if (error) {
    console.error("Error updating email:", error);
  } else {
    console.log("Successfully updated email in DB to panthu13147@gmail.com", data);
  }
}

main();
