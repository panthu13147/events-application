import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/supabase";
import { formatDayDate, formatEventDates } from "@/lib/events";
import { getCommunityGroup } from "@/config/community";
import { getEventFeatures } from "@/config/event-features";
import { TicketQR } from "./TicketQR";
import { accentBlock, type Accent } from "@/components/s4ds";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your ticket" };

/** The notch that turns a panel into a ticket stub. */
function Notch({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={`absolute -top-[16px] size-[29px] rounded-full border-[3px] border-[var(--s4ds-edge)] bg-[var(--s4ds-void)] ${
        side === "left" ? "-left-[16px]" : "-right-[16px]"
      }`}
    />
  );
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: registration, error } = await db
    .from("registrations")
    .select("id, code, qr_token, full_name, status, event_id")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!registration) notFound();

  const [{ data: event }, { data: days }, { data: attendance }] = await Promise.all([
    db.from("events").select("*").eq("id", registration.event_id).single(),
    db
      .from("event_days")
      .select("*")
      .eq("event_id", registration.event_id)
      .order("day_number", { ascending: true }),
    db.from("attendance").select("event_day_id").eq("registration_id", registration.id),
  ]);

  if (!event) notFound();

  const attended = new Set((attendance ?? []).map((row) => row.event_day_id));
  const group = getCommunityGroup(event.slug);
  const features = getEventFeatures(event.slug);
  // The ticket showed `formatDayDate(day.date)` unconditionally, which leaks
  // the placeholder date the rest of the site hides for a scheduled-TBA event.
  const datesTba = features.scheduleTba;
  const pending = registration.status === "PENDING";
  const waitlisted = registration.status === "WAITLISTED";
  const rejected = registration.status === "REJECTED" || registration.status === "CANCELLED";

  // Colour never carries the status alone — the band always spells it out.
  const status: { accent: Accent; label: string } = rejected
    ? { accent: "orange", label: "Not valid" }
    : waitlisted
      ? { accent: "peri", label: "On the waitlist" }
      : pending
        ? { accent: "yellow", label: "Awaiting approval" }
        : { accent: "green", label: "Ready to scan" };

  // No ticket, no QR: this page is just the confirmation, and the group link is
  // the only thing on it worth acting on. Rendering the stub anyway would put a
  // scannable-looking QR in front of someone at an event with no door check —
  // they'd hold up a phone at a volunteer who has nothing to scan it with.
  if (!features.ticket) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-12 sm:py-16">
        <div className="rounded-[var(--s4ds-r-sm)] border-[3px] border-[var(--s4ds-edge)] bg-[var(--s4ds-bone)] text-[var(--s4ds-ink-invert)] shadow-[var(--s4ds-shadow-lg)]">
          <div
            className={`border-b-[3px] border-[var(--s4ds-edge)] px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] ${accentBlock(status.accent)}`}
          >
            S4DS · KJSIT
          </div>

          <div className="px-6 py-7 text-center">
            <h1 className="text-2xl font-black uppercase leading-[1.05] tracking-[-0.02em] text-balance">
              {event.title}
            </h1>

            <p className="mt-5 text-lg font-black tracking-[-0.01em]">
              {registration.full_name}
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-[0.28em] text-[var(--s4ds-ink-invert-dim)]">
              {registration.code}
            </p>

            <p className="mt-5 rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-edge)] px-4 py-3 text-sm leading-snug">
              {rejected ? (
                <>
                  <strong className="font-black">
                    This registration is no longer valid.
                  </strong>{" "}
                  Talk to the organisers if you think that&apos;s a mistake.
                </>
              ) : waitlisted ? (
                <>
                  <strong className="font-black">
                    The event was full when you signed up.
                  </strong>{" "}
                  You&apos;re on the waitlist and we&apos;ll be in touch if a place opens up.
                </>
              ) : pending ? (
                <>
                  <strong className="font-black">You&apos;re registered.</strong> An
                  organiser is reviewing your team — quote the code above if you need to
                  ask about it.
                </>
              ) : (
                <>
                  <strong className="font-black">You&apos;re in.</strong> Quote the code
                  above if you need to ask us anything.
                </>
              )}
            </p>
          </div>
        </div>

        {group && !rejected ? (
          <a
            href={group.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-between gap-4 rounded-[var(--s4ds-r-sm)] border-[3px] border-[var(--s4ds-edge)] bg-[var(--s4ds-green)] px-5 py-4 text-[var(--s4ds-bone)] shadow-[var(--s4ds-shadow)] transition-[transform,box-shadow] duration-150 ease-[var(--s4ds-ease)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--s4ds-shadow-lg)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[var(--s4ds-shadow-press)]"
          >
            <span>
              <span className="block text-base font-black tracking-[-0.01em]">
                {group.label}
              </span>
              <span className="mt-1 block text-sm leading-snug opacity-90 text-pretty">
                {group.reason}
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-xl font-black">
              →
            </span>
          </a>
        ) : null}

        <p className="mt-6 text-center text-sm text-[var(--s4ds-ink-dim)] text-pretty">
          {/* Only true for events with no email at all (e.g. Mahakumbh) —
              for one that does mail a copy (e.g. Knowbuild), saying so here
              would just be wrong. */}
          {features.email ? "Bookmark this page." : "Bookmark this page — we don't email a copy."}{" "}
          <Link
            href={`/${event.slug}`}
            className="font-bold text-[var(--s4ds-yellow)] underline underline-offset-4"
          >
            Event details
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12 sm:py-16">
      <div className="rounded-[var(--s4ds-r-sm)] border-[3px] border-[var(--s4ds-edge)] bg-[var(--s4ds-bone)] text-[var(--s4ds-ink-invert)] shadow-[var(--s4ds-shadow-lg)]">
        <div
          className={`flex items-center justify-between gap-3 border-b-[3px] border-[var(--s4ds-edge)] px-5 py-2.5 ${accentBlock(status.accent)}`}
        >
          <span className="text-xs font-black uppercase tracking-[0.14em]">S4DS · KJSIT</span>
          <span className="text-xs font-black uppercase tracking-[0.06em]">{status.label}</span>
        </div>

        <div className="px-5 py-6 text-center">
          <h1 className="text-2xl font-black uppercase leading-[1.05] tracking-[-0.02em] text-balance">
            {event.title}
          </h1>
          <p className="mt-2 text-sm font-bold text-[var(--s4ds-ink-invert-dim)]">
            {formatEventDates(event)}
          </p>
          {event.venue ? (
            <p className="text-sm text-[var(--s4ds-ink-invert-dim)]">{event.venue}</p>
          ) : null}
        </div>

        <div className="relative border-t-[3px] border-dashed border-[var(--s4ds-edge)]">
          <Notch side="left" />
          <Notch side="right" />
        </div>

        <div className="flex flex-col items-center gap-5 px-5 pb-6 pt-8">
          {rejected ? (
            <div className="rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-orange)] bg-[color-mix(in_srgb,var(--s4ds-orange)_14%,transparent)] p-4 text-center text-sm font-bold">
              This registration is no longer valid. Talk to the organisers if you think
              that&apos;s a mistake.
            </div>
          ) : waitlisted ? (
            /* No QR: there is nothing to scan yet, and showing one would read
               as "you're in". */
            <div className="rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-edge)] bg-[color-mix(in_srgb,var(--s4ds-peri)_28%,transparent)] p-4 text-center text-sm leading-snug">
              <strong className="font-black">The event was full when you signed up.</strong>{" "}
              You&apos;re on the waitlist. We&apos;ll get in touch if a seat opens up. Keep this
              link; your ticket appears here if you get one.
            </div>
          ) : (
            <>
              <TicketQR token={registration.qr_token} />
              {pending ? (
                <p className="rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-edge)] bg-[color-mix(in_srgb,var(--s4ds-yellow)_35%,transparent)] px-4 py-3 text-center text-sm leading-snug">
                  <strong className="font-black">An organiser is checking your payment.</strong>{" "}
                  Keep this link. The QR starts working once approved.
                </p>
              ) : (
                <p className="text-center text-sm font-bold text-[var(--s4ds-ink-invert-dim)]">
                  Show this at the door on each day.
                </p>
              )}
            </>
          )}

          <div className="w-full border-t-2 border-[var(--s4ds-ink-invert)]/20 pt-4 text-center">
            <p className="text-lg font-black tracking-[-0.01em]">{registration.full_name}</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-[0.28em] text-[var(--s4ds-ink-invert-dim)]">
              {registration.code}
            </p>
          </div>
        </div>

        {days && days.length > 0 ? (
          <ul className="border-t-[3px] border-[var(--s4ds-edge)]">
            {days.map((day) => {
              const checkedIn = attended.has(day.id);
              return (
                <li
                  key={day.id}
                  className="flex items-center justify-between gap-3 border-b-2 border-[var(--s4ds-ink-invert)]/15 px-5 py-3 text-sm last:border-b-0"
                >
                  <div>
                    <p className="font-black">{day.label ?? `Day ${day.day_number}`}</p>
                    {datesTba ? null : (
                      <p className="text-xs text-[var(--s4ds-ink-invert-dim)]">
                        {formatDayDate(day.date)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-edge)] px-2 py-1 text-xs font-black uppercase tracking-[0.04em] leading-none ${
                      checkedIn
                        ? "bg-[var(--s4ds-green)] text-[var(--s4ds-bone)]"
                        : "bg-transparent text-[var(--s4ds-ink-invert-dim)]"
                    }`}
                  >
                    {checkedIn ? "✓ Checked in" : "Not yet"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {group && !rejected ? (
        // Below the ticket, not inside it: the stub is the thing to screenshot
        // and this is a thing to tap. For events that send no email, this is
        // the ONLY channel that reaches someone after they close this page —
        // so it gets a real button, not a line of small print.
        <a
          href={group.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-between gap-4 rounded-[var(--s4ds-r-sm)] border-[3px] border-[var(--s4ds-edge)] bg-[var(--s4ds-green)] px-5 py-4 text-[var(--s4ds-bone)] shadow-[var(--s4ds-shadow)] transition-[transform,box-shadow] duration-150 ease-[var(--s4ds-ease)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--s4ds-shadow-lg)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[var(--s4ds-shadow-press)]"
        >
          <span>
            <span className="block text-base font-black tracking-[-0.01em]">
              {group.label}
            </span>
            <span className="mt-1 block text-sm leading-snug opacity-90 text-pretty">
              {group.reason}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-xl font-black">
            →
          </span>
        </a>
      ) : null}

      <p className="mt-6 text-center text-sm text-[var(--s4ds-ink-dim)] text-pretty">
        Bookmark this page. It&apos;s your ticket.{" "}
        <Link
          href={`/${event.slug}`}
          className="font-bold text-[var(--s4ds-yellow)] underline underline-offset-4"
        >
          Event details
        </Link>
      </p>
    </main>
  );
}
