import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/**
 * Creates (or updates) the Mahakumbh Hackathon event.
 *
 * Selected teams work with the Government of Maharashtra on the Nashik Kumbh
 * Mela (Aug-Sep 2027). Twelve problem statements from the WRC/ICSSR call,
 * three teams shortlisted per statement, two members per team.
 *
 * This event sends NO EMAIL at any stage and issues no certificates. The
 * no-email block is a slug in src/config/email-policy, not a flag on the row —
 * see that file for what it costs (no ticket resend, no paper trail). The
 * WhatsApp group in src/config/community is the channel that replaces it, and
 * the ticket page is where people are asked to join.
 *
 * Safe to re-run - it upserts on slug rather than wiping, unlike `db:seed`.
 * Unlike create-ai-agents-event.ts this does NOT touch admin_users; use
 * scripts/create-admin.ts if you need a login.
 *
 *   npx tsx scripts/create-mahakumbh-hackathon-event.ts
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

// Confirmed: 9 September 2026. IST offset is explicit, same as the other
// event scripts.
const PLACEHOLDER_START = "2026-09-09T09:00:00+05:30";
const PLACEHOLDER_END = "2026-09-09T18:00:00+05:30";

const REGISTRATION_CLOSES_AT = "2026-09-08T23:59:00+05:30";

// 12 problem statements x 3 teams. Capacity counts TEAMS, because one
// registration is one team — 36 teams is 72 people in the room.
const PROBLEM_STATEMENTS = 12;
const TEAMS_PER_PROBLEM_STATEMENT = 3;
const MEMBERS_PER_TEAM = 2;
const TEAM_CAPACITY = PROBLEM_STATEMENTS * TEAMS_PER_PROBLEM_STATEMENT;

async function main() {
  const [event] = check(
    "upsert event",
    await db
      .from("events")
      .upsert(
        {
          slug: "mahakumbh-hackathon",
          title: "Mahakumbh Hackathon",
          tagline: "Build for the Nashik Kumbh Mela, with the Government of Maharashtra",
          description: [
            "The Mahakumbh was organised in Prayagraj in 2025. The next Kumbh Mela comes to **Nashik, Maharashtra** in August–September 2027 — and the planning starts now.",
            "",
            "Working from the Western Regional Centre (WRC/ICSSR) call for research on *Learnings from Organization of Mahakumbh*, this hackathon puts student teams on the same twelve problems. **Selected teams work directly with the Government of Maharashtra**, and their output is submitted to the state for the organisation of the Kumbh Mela.",
            "",
            "**How it works**",
            "",
            `- Teams of exactly **${MEMBERS_PER_TEAM}**. One person registers for the team and is the contact for everything after.`,
            `- You pick **one** of the ${PROBLEM_STATEMENTS} problem statements below when you register.`,
            `- **${TEAMS_PER_PROBLEM_STATEMENT} teams per problem statement** — ${TEAM_CAPACITY} teams in total. A statement closes as soon as it has ${TEAMS_PER_PROBLEM_STATEMENT}, so the live count next to each one below is what's actually left.`,
            "- Your written approach still matters — it's what the panel reads first. Register early for the statement you want.",
            "",
            // The twelve statements are NOT repeated here. They live in
            // src/config/problem-statements and the event page renders them as
            // their own section — one list, one place to correct a typo.
            "**What to bring**",
            "",
            "Your own laptop. Bring anything you've already read on crowd management, civic planning or the 2025 Mahakumbh — the strongest submissions are the ones that start from real material rather than from scratch.",
            "",
            "Open to KJSIT students across all departments and years.",
          ].join("\n"),
          // Venue still isn't decided; the date is confirmed above.
          venue: null,
          form_key: "mahakumbh-hackathon",
          starts_at: PLACEHOLDER_START,
          ends_at: PLACEHOLDER_END,
          capacity: TEAM_CAPACITY,
          // The cap that actually bites: 3 teams per problem statement. Once a
          // statement has 3, it stops accepting teams while the other eleven
          // stay open — which the event-level `capacity` above can't express,
          // since it only knows the total.
          //
          // Enforced inside register_for_event (0008_slot_capacity.sql), under
          // the same row lock as the seat count, so two teams can't both become
          // the third for one statement.
          slot_answer_key: "problem_statement",
          slot_capacity: TEAMS_PER_PROBLEM_STATEMENT,
          status: "PUBLISHED",
          registration_opens_at: new Date().toISOString(),
          registration_closes_at: REGISTRATION_CLOSES_AT,
          // Free — the selection, not a fee, is the filter.
          requires_payment: false,
          fee_amount: null,
          payment_qr_url: null,
          // Every team starts PENDING. Three per problem statement are approved
          // by hand from /admin/events/mahakumbh-hackathon — auto-approve here
          // would hand out all 36 places first-come-first-served and defeat the
          // whole selection.
          auto_approve: false,
          // No certificates for now. Turning this back on is this one flag plus
          // a re-run — nothing else is wired to it.
          certificate_enabled: false,
        },
        { onConflict: "slug" },
      )
      .select("*"),
  );

  console.log(`Event: ${event.title} (${event.id})`);

  // ONE day, because the duration isn't decided yet.
  //
  // A day row still has to exist — attendance hangs off `event_days`, so with
  // none of them the scanner has nothing to scan against. One unlabelled day is
  // the minimum that keeps check-in working without inventing a running order.
  //
  // If it turns out to be two days: add a `day_number: 2` row to DAYS below and
  // re-run. The upsert is keyed on (event_id, day_number), so day 1 is left
  // alone and any attendance already recorded against it survives. Give both
  // rows labels at that point — the event page only shows the day list when
  // there's more than one, so a lone unlabelled day renders nothing either way.
  const DAYS = [
    {
      event_id: event.id,
      day_number: 1,
      label: null,
      date: PLACEHOLDER_START,
    },
  ];

  check(
    "upsert days",
    await db.from("event_days").upsert(DAYS, { onConflict: "event_id,day_number" }).select("id"),
  );

  // An upsert only ever adds and updates. A day that used to exist and no
  // longer appears above would otherwise sit in the database forever, which is
  // exactly how a "Day 2" from a previous run survives into a one-day event and
  // shows up on the public page. Converge instead: whatever DAYS says, wins.
  const stale = check(
    "find stale days",
    await db
      .from("event_days")
      .select("id, day_number")
      .eq("event_id", event.id)
      .gt("day_number", DAYS.length),
  );

  if (stale.length > 0) {
    // Deleting an event_day CASCADES to its attendance rows. Silently wiping
    // check-ins because someone re-ran a seed script is not a trade worth
    // making, so this stops and asks rather than deciding on its own.
    const scanned = check(
      "count attendance on stale days",
      await db
        .from("attendance")
        .select("id")
        .in(
          "event_day_id",
          stale.map((day) => day.id),
        ),
    );

    if (scanned.length > 0) {
      console.error(
        `\nRefusing to remove day(s) ${stale.map((d) => d.day_number).join(", ")}: ` +
          `${scanned.length} attendance record(s) hang off them and would be deleted too.\n` +
          `Either add those days back to DAYS in this script, or delete them by hand ` +
          `if you really mean to lose the check-ins.`,
      );
      process.exit(1);
    }

    check(
      "delete stale days",
      await db
        .from("event_days")
        .delete()
        .in(
          "id",
          stale.map((day) => day.id),
        )
        .select("id"),
    );

    console.log(`Removed day(s) ${stale.map((d) => d.day_number).join(", ")} — no longer in DAYS.`);
  }

  console.log("\nDone.");
  console.log(`  Public page : /${event.slug}`);
  console.log(`  Admin        : /admin/events/${event.slug}`);
  console.log(
    `\nCapacity: ${TEAM_CAPACITY} teams ` +
      `(${PROBLEM_STATEMENTS} problem statements x ${TEAMS_PER_PROBLEM_STATEMENT}) ` +
      `= ${TEAM_CAPACITY * MEMBERS_PER_TEAM} people.`,
  );
  console.log(`\nOne day row, dated ${PLACEHOLDER_START} -> ${PLACEHOLDER_END}.`);
  console.log(
    "\nNot set yet, by design: venue and duration (one day row, because how\n" +
      "long the event runs hasn't been decided — add a second row here if it\n" +
      "turns out to be two days).",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
