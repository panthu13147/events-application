import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: events, error: fetchError } = await supabase.from("events").select("id, slug");
  if (fetchError) throw fetchError;

  const regs = events.map((e) => ({
    event_id: e.id,
    full_name: "Panth Shah",
    email: "panth.shah@somaiya.edu",
    phone: "1234567890",
    status: "APPROVED",
    code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    qr_token: Math.random().toString(36).substring(2, 15),
    answers: {},
  }));

  const { error: insertError } = await supabase.from("registrations").insert(regs);
  if (insertError) throw insertError;

  console.log(`Added Panth Shah to ${regs.length} events successfully!`);
}

main().catch(console.error);
