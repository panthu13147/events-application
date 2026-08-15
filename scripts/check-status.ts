import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data } = await supabase
    .from("certificate_jobs")
    .select(`id, status, error_msg, events(title)`)
    .order("created_at", { ascending: false });

  console.log("Certificate Jobs:");
  console.log(data);
}

main();
