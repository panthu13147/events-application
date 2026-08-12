import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { hashPassword } from "../src/lib/password";

/**
 * Creates (or updates) the AI Agents Workshop event and an OWNER admin login.
 *
 * Safe to re-run — it upserts on slug rather than wiping, unlike `db:seed`.
 *
 *   npx tsx scripts/create-ai-agents-event.ts
 */

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");

const db = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function check<T>(what: string, result: { data: T | null; error: unknown }): T {
  if (result.error) {
    console.error(`\n${what} failed:`, result.error);
    process.exit(1);
  }
  return result.data as T;
}

// IST. Storing the offset explicitly avoids "why is my event at 9:30am" bugs.
const DAY_1_START = "2026-08-20T15:00:00+05:30";
const DAY_1_END = "2026-08-20T18:00:00+05:30";
const DAY_2_START = "2026-08-21T15:00:00+05:30";
const DAY_2_END = "2026-08-21T18:00:00+05:30";

async function main() {
  const [event] = check(
    "upsert event",
    await db
      .from("events")
      .upsert(
        {
          slug: "ai-agents-workshop",
          title: "AI Agents Workshop",
          tagline: "From prompting to fine-tuning",
          description: [
            "A hands-on two-day workshop on building AI agents — from your first prompt to a fine-tuned model running in a Space.",
            "",
            "**What we'll cover**",
            "",
            "- Agents, tools and the ReAct loop",
            "- Building with `smolagents`",
            "- RAG: giving your agent something to read",
            "- LoRA and fine-tuning",
            "- Shipping to Hugging Face Spaces",
            "",
            "**What to bring**",
            "",
            "Your own laptop is strongly recommended — you'll leave with a working environment. Lab machines are available but limited.",
            "",
            "No prior ML experience needed. Basic Python helps, but complete beginners are welcome — we seat people in pairs.",
          ].join("\n"),
          venue: "Lab 401, KJSIT",
          form_key: "ai-agents-workshop",
          starts_at: DAY_1_START,
          ends_at: DAY_2_END,
          capacity: 60,
          status: "PUBLISHED",
          registration_opens_at: new Date().toISOString(),
          registration_closes_at: "2026-08-19T23:59:00+05:30",
          requires_payment: true,
          fee_amount: 10_000, // 100 rupees, in paise
          // Drop your UPI QR image at public/payment-qr.svg
          payment_qr_url: "/payment-qr.svg",
          // Paid event: a human checks each payment screenshot before approving.
          auto_approve: false,
          certificate_enabled: true,
        },
        { onConflict: "slug" },
      )
      .select("*"),
  );

  console.log(`Event: ${event.title} (${event.id})`);

  // Days are upserted separately so re-running doesn't duplicate them.
  check(
    "upsert days",
    await db
      .from("event_days")
      .upsert(
        [
          {
            event_id: event.id,
            day_number: 1,
            label: "Day 1 — Agents, tools & RAG",
            date: DAY_1_START,
          },
          {
            event_id: event.id,
            day_number: 2,
            label: "Day 2 — Fine-tuning & shipping",
            date: DAY_2_START,
          },
        ],
        { onConflict: "event_id,day_number" },
      )
      .select("id"),
  );

  // --- an admin login, so you can actually get into /admin ------------------

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@s4ds.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  check(
    "upsert admin",
    await db
      .from("admin_users")
      .upsert(
        {
          email,
          name: "S4DS Owner",
          role: "OWNER",
          password_hash: await hashPassword(password),
        },
        { onConflict: "email" },
      )
      .select("id"),
  );

  console.log("\nDone.");
  console.log(`  Public page : /${event.slug}`);
  console.log(`  Admin login : /admin/login  ->  ${email} / ${password}`);
  console.log(`  Scanner     : /admin/scan`);
  console.log(`\nDay 1: ${DAY_1_START}  ->  ${DAY_1_END}`);
  console.log(`Day 2: ${DAY_2_START}  ->  ${DAY_2_END}`);
  console.log("\nRemember to put your UPI QR image at public/payment-qr.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
