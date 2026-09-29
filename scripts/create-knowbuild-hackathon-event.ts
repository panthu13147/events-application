import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/**
 * Creates (or updates) the Knowbuild 2.0 event.
 *
 * 8-hour intra-college hackathon for SY/TY students, Open Innovation theme:
 * bring a brand-new idea and build it from scratch, or take an existing
 * project and push it further with new features. Teams of 2-4.
 *
 * Safe to re-run — it upserts on slug rather than wiping, unlike `db:seed`.
 * Unlike create-ai-agents-event.ts this does NOT touch admin_users; use
 * scripts/create-admin.ts if you need a login.
 *
 *   npx tsx scripts/create-knowbuild-hackathon-event.ts
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

// 26 September 2026, 8am to 4pm — 8 hours, IST offset explicit.
const STARTS_AT = "2026-09-26T08:00:00+05:30";
const ENDS_AT = "2026-09-26T16:00:00+05:30";

// Registration deadline: 24 Sep 2026, 8:30 PM.
const REGISTRATION_CLOSES_AT = "2026-09-24T20:30:00+05:30";

async function main() {
  const [event] = check(
    "upsert event",
    await db
      .from("events")
      .upsert(
        {
          slug: "knowbuild-2-0",
          title: "Knowbuild 2.0",
          tagline: "8-hour intra-college hackathon — Open Innovation",
          description: [
            "An **8-hour intra-college hackathon** for SY/TY students to explore, build, and ship.",
            "",
            "**Theme: Open Innovation** — bring any problem worth solving. Come with a brand-new idea and build it from scratch, or take an existing project of yours and push it further with new features.",
            "",
            "It's about hands-on exposure — experimenting with new tools, sharpening execution under time pressure, and presenting what you've built.",
            "",
            "Open to all FY/SY/TY teams. No prior hackathon experience needed.",
            "",
            "**Team size:** 2-4.",
          ].join("\n"),
          venue: null,
          banner_url: "/kb2-logo.jpeg",
          form_key: "knowbuild-2-0",
          starts_at: STARTS_AT,
          ends_at: ENDS_AT,
          // No headcount cap given — every SY/TY team that registers before the
          // deadline is in.
          capacity: null,
          slot_answer_key: null,
          slot_capacity: null,
          status: "PUBLISHED",
          registration_opens_at: new Date().toISOString(),
          registration_closes_at: REGISTRATION_CLOSES_AT,
          requires_payment: false,
          fee_amount: null,
          payment_qr_url: null,
          // Every team starts PENDING and is reviewed by hand from
          // /admin/events/knowbuild-2-0 — no automatic acceptance email or QR
          // ticket goes out at registration. Approving sends the "approved"
          // template with the QR; a team that's still PENDING only ever gets
          // the plain "registered, under review" confirmation.
          auto_approve: false,
          certificate_enabled: false,
        },
        { onConflict: "slug" },
      )
      .select("*"),
  );

  console.log(`Event: ${event.title} (${event.id})`);

  const DAYS = [
    {
      event_id: event.id,
      day_number: 1,
      label: null,
      date: STARTS_AT,
    },
  ];

  check(
    "upsert days",
    await db.from("event_days").upsert(DAYS, { onConflict: "event_id,day_number" }).select("id"),
  );

  console.log("\nDone.");
  console.log(`  Public page : /${event.slug}`);
  console.log(`  Admin        : /admin/events/${event.slug}`);
  console.log(`\nRuns ${STARTS_AT} -> ${ENDS_AT}. Registration closes ${REGISTRATION_CLOSES_AT}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
