import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { hashPassword } from "../src/lib/password";
import { generateCode, generateQrToken } from "../src/lib/ids";

/**
 * Development seed. Everyone on the team runs this so they can build UI
 * against realistic data instead of doing data entry by hand.
 *
 * It WIPES events, registrations and admins. Never point it at production.
 */

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed a production database.");
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
}

const db = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** supabase-js returns errors instead of throwing — make failures loud. */
function check<T>(what: string, result: { data: T | null; error: unknown }): T {
  if (result.error) {
    console.error(`\n${what} failed:`, result.error);
    process.exit(1);
  }
  return result.data as T;
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (daysFromNow: number, hour = 10) => {
  const d = new Date(now + daysFromNow * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

// Deterministic pseudo-random so everyone's seed data looks the same and bugs
// are reproducible across machines.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];

const FIRST = ["Aarav", "Diya", "Rohan", "Sara", "Kabir", "Ananya", "Vivaan", "Meera",
  "Arjun", "Isha", "Neel", "Tara", "Om", "Riya", "Yash", "Nisha", "Dev", "Kavya"];
const LAST = ["Sharma", "Patel", "Iyer", "Nair", "Singh", "Desai", "Joshi", "Rao",
  "Mehta", "Kulkarni", "Shah", "Reddy"];

async function main() {
  console.log("Clearing existing data...");
  // events cascade to days, registrations, attendance and certificates.
  check("clear email_jobs", await db.from("email_jobs").delete().not("id", "is", null).select("id"));
  check("clear events", await db.from("events").delete().not("id", "is", null).select("id"));
  check("clear admin_users", await db.from("admin_users").delete().not("id", "is", null).select("id"));

  // --- admins --------------------------------------------------------------

  const ownerEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@s4ds.local";
  const ownerPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  check(
    "create admins",
    await db
      .from("admin_users")
      .insert([
        {
          email: ownerEmail,
          name: "S4DS Owner",
          role: "OWNER",
          password_hash: await hashPassword(ownerPassword),
        },
        {
          email: "core@s4ds.local",
          name: "Core Member",
          role: "ADMIN",
          password_hash: await hashPassword("changeme123"),
        },
        {
          email: "volunteer@s4ds.local",
          name: "Event Volunteer",
          role: "SCANNER",
          password_hash: await hashPassword("changeme123"),
        },
      ])
      .select("id"),
  );

  // --- events --------------------------------------------------------------

  async function createEvent(
    event: Database["public"]["Tables"]["events"]["Insert"],
    days: { day_number: number; label: string; date: string }[],
  ) {
    const [row] = check(
      `create event ${event.slug}`,
      await db.from("events").insert(event).select("*"),
    );
    const dayRows = check(
      `create days for ${event.slug}`,
      await db
        .from("event_days")
        .insert(days.map((d) => ({ ...d, event_id: row.id })))
        .select("*"),
    );
    return { ...row, days: dayRows };
  }

  // Open for registration, paid, two days, certificates on.
  const llm = await createEvent(
    {
      slug: "llm-masterclass",
      title: "LLM Masterclass",
      tagline: "Build and ship your first LLM app in two days",
      description:
        "A hands-on two-day workshop covering prompting, RAG and evaluation.\n\nBring a laptop. No prior ML experience needed.",
      venue: "Seminar Hall, 4th Floor",
      form_key: "kjsit-student",
      starts_at: at(12, 9),
      ends_at: at(13, 17),
      capacity: 70,
      status: "PUBLISHED",
      registration_opens_at: at(-5),
      registration_closes_at: at(10),
      requires_payment: true,
      fee_amount: 25_000, // 250 rupees, in paise
      payment_qr_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      auto_approve: false, // paid event: an admin checks each payment proof
      certificate_enabled: true,
      certificate_template_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      certificate_config: {
        name: { x: 400, y: 300, size: 32 },
        date: { x: 400, y: 420, size: 14 },
        serial: { x: 60, y: 560, size: 9 },
      },
    },
    [
      { day_number: 1, label: "Day 1 — Foundations", date: at(12, 9) },
      { day_number: 2, label: "Day 2 — Build & Ship", date: at(13, 9) },
    ],
  );

  // Published but registration hasn't opened yet -> "Upcoming" on the homepage.
  const git = await createEvent(
    {
      slug: "intro-to-git",
      title: "Intro to Git & GitHub",
      tagline: "Stop emailing zip files to your teammates",
      description: "A free single-session workshop on version control basics.",
      venue: "Lab 302",
      form_key: "minimal",
      starts_at: at(30, 14),
      ends_at: at(30, 17),
      capacity: null, // unlimited
      status: "PUBLISHED",
      registration_opens_at: at(20),
      registration_closes_at: at(29),
      requires_payment: false,
      auto_approve: true,
    },
    [{ day_number: 1, label: "Session", date: at(30, 14) }],
  );

  // Finished -> "Past" on the homepage.
  const datathon = await createEvent(
    {
      slug: "datathon-2026",
      title: "S4DS Datathon 2026",
      tagline: "24 hours, one dataset, too much coffee",
      description: "Our annual inter-college data science hackathon.",
      venue: "Main Auditorium",
      form_key: "open-public",
      starts_at: at(-40, 9),
      ends_at: at(-39, 18),
      capacity: 120,
      status: "PUBLISHED",
      registration_opens_at: at(-60),
      registration_closes_at: at(-42),
      requires_payment: false,
      auto_approve: true,
      certificate_enabled: true,
    },
    [
      { day_number: 1, label: "Day 1", date: at(-40, 9) },
      { day_number: 2, label: "Day 2", date: at(-39, 9) },
    ],
  );

  // --- registrations -------------------------------------------------------

  const usedEmails = new Set<string>();
  function person(index: number) {
    const first = pick(FIRST);
    const last = pick(LAST);
    let email = `${first}.${last}${index}`.toLowerCase() + "@somaiya.edu";
    while (usedEmails.has(email)) email = `x${email}`;
    usedEmails.add(email);
    return { full_name: `${first} ${last}`, email };
  }

  async function seedRegistrations(
    event: Awaited<ReturnType<typeof createEvent>>,
    count: number,
    build: (index: number) => {
      status: Database["public"]["Enums"]["reg_status"];
      answers: Record<string, string>;
      /** how many of the event's days this person attended, from day 1 */
      attendedDays: number;
    },
  ) {
    // Build once — `build` consumes the shared RNG, so calling it twice per
    // person would shift every subsequent value.
    const specs = Array.from({ length: count }, (_, i) => build(i));

    const rows = specs.map(({ status, answers }, i) => {
      const { full_name, email } = person(i);
      return {
        event_id: event.id,
        code: generateCode(),
        qr_token: generateQrToken(),
        full_name,
        email,
        phone: `+9198${String(10_000_000 + Math.floor(rand() * 89_999_999))}`,
        answers,
        status,
        payment_proof_url: event.requires_payment
          ? "https://res.cloudinary.com/demo/image/upload/sample.jpg"
          : null,
      };
    });

    const inserted = check(
      `create registrations for ${event.slug}`,
      await db.from("registrations").insert(rows).select("id"),
    );

    const attendance = inserted.flatMap((reg, i) =>
      event.days
        .filter((d) => d.day_number <= specs[i].attendedDays)
        .map((d) => ({
          registration_id: reg.id,
          event_day_id: d.id,
          scanned_by: "seed",
        })),
    );

    if (attendance.length > 0) {
      check(
        `create attendance for ${event.slug}`,
        await db.from("attendance").insert(attendance).select("id"),
      );
    }
  }

  console.log("Seeding registrations...");

  // Paid event: a mix of approved, pending payment review, and one rejected.
  await seedRegistrations(llm, 18, (i) => ({
    status: i < 12 ? "APPROVED" : i < 17 ? "PENDING" : "REJECTED",
    answers: {
      department: pick(["AIDS", "COMPS", "IT", "EXTC"]),
      year: pick(["SE", "TE", "BE"]),
      division: pick(["A", "B", "C"]),
    },
    attendedDays: 0, // hasn't happened yet
  }));

  await seedRegistrations(git, 6, () => ({
    status: "APPROVED",
    answers: {},
    attendedDays: 0,
  }));

  // Past event: the interesting one. Some attended both days (certificate
  // eligible), some only day 1 (not eligible), some no-showed entirely.
  await seedRegistrations(datathon, 14, (i) => ({
    status: "APPROVED",
    answers: {
      organization: pick(["KJSIT", "VJTI", "DJ Sanghvi", "Thadomal"]),
      role: pick(["Student", "Working professional"]),
    },
    attendedDays: i < 8 ? 2 : i < 12 ? 1 : 0,
  }));

  // --- summary -------------------------------------------------------------

  const count = async (table: "events" | "registrations" | "attendance" | "admin_users") =>
    (await db.from(table).select("*", { count: "exact", head: true })).count ?? 0;

  console.log("\nSeeded:", {
    events: await count("events"),
    registrations: await count("registrations"),
    attendance: await count("attendance"),
    admins: await count("admin_users"),
  });

  console.log("\nSign in at /admin/login");
  console.log(`  OWNER   ${ownerEmail} / ${ownerPassword}`);
  console.log("  ADMIN   core@s4ds.local / changeme123");
  console.log("  SCANNER volunteer@s4ds.local / changeme123");
  console.log(`\nEvents: /${llm.slug}  /${git.slug}  /${datathon.slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
