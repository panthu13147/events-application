import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: regs } = await supabase
    .from("registrations")
    .select(`
      id, full_name,
      certificate_jobs(status)
    `)
    .eq("email", "panthu13147@gmail.com")
    .eq("status", "APPROVED");

  console.log(JSON.stringify(regs, null, 2));
}

main();
