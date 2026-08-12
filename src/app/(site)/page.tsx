import Link from "next/link";
import { getHomepageEvents, formatEventDates } from "@/lib/events";
import type { Event } from "@/lib/database.types";
import {
  Chip,
  PanelLink,
  SectionHeading,
  Slab,
  accentAt,
  accentBlock,
  accentFill,
  type Accent,
} from "@/components/s4ds";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Events",
  description: "Workshops, hackathons and sessions by S4DS, KJSIT.",
};

const IST = "Asia/Kolkata";

/** The date tile only ever shows month + day; the full range lives in the meta row. */
function tileDate(iso: string) {
  const date = new Date(iso);
  return {
    month: date
      .toLocaleDateString("en-IN", { month: "short", timeZone: IST })
      .toUpperCase(),
    day: date.toLocaleDateString("en-IN", { day: "2-digit", timeZone: IST }),
  };
}

function EventRow({
  event,
  accent,
  index,
  dimmed = false,
}: {
  event: Event;
  accent: Accent;
  index: number;
  dimmed?: boolean;
}) {
  const { month, day } = tileDate(event.starts_at);

  return (
    <li className="s4ds-rise" style={{ "--i": index } as React.CSSProperties}>
      <PanelLink href={`/${event.slug}`} className="overflow-hidden">
        <div className="flex items-stretch">
          <div
            className={`${accentBlock(accent)} flex w-20 shrink-0 flex-col items-center justify-center border-r-[3px] border-[var(--s4ds-edge)] px-2 py-4 sm:w-24`}
          >
            <span className="text-[0.6875rem] font-black tracking-[0.12em]">{month}</span>
            <span className="text-3xl font-black leading-none tabular-nums sm:text-4xl">
              {day}
            </span>
          </div>

          <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black leading-tight tracking-[-0.015em] text-balance sm:text-xl">
                {event.title}
              </h3>
              {dimmed ? null : (
                <span className="mt-0.5 shrink-0 rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-edge)] bg-[var(--s4ds-green)] px-2 py-1 text-xs font-black uppercase tracking-[0.04em] leading-none text-[var(--s4ds-bone)]">
                  {/* Every fee in this app is a refundable deposit, not a
                      ticket price, so the listing prices the event itself:
                      free. The deposit amount and the conditions for getting
                      it back are stated on the event page, before anyone
                      pays. If a genuinely non-refundable event is ever added,
                      this needs a flag to distinguish the two. */}
                  Free
                </span>
              )}
            </div>

            {event.tagline ? (
              <p className="mt-1.5 text-sm leading-snug text-[var(--s4ds-ink-invert-dim)]">
                {event.tagline}
              </p>
            ) : null}

            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] font-medium text-[var(--s4ds-ink-invert-dim)]">
              <span>{formatEventDates(event)}</span>
              {event.venue ? (
                <>
                  <span aria-hidden className="text-[var(--s4ds-ink-invert-dim)]/50">
                    ·
                  </span>
                  <span>{event.venue}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </PanelLink>
    </li>
  );
}

/** Past events get a timeline, not cards — they're a sequence, and the shape says so. */
function PastTimeline({ events }: { events: Event[] }) {
  return (
    <ol className="relative mt-6 space-y-6 pl-7">
      <span
        aria-hidden
        className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[var(--s4ds-ink)]/20"
      />
      {events.map((event, index) => {
        const { month, day } = tileDate(event.starts_at);
        return (
          <li key={event.id} className="relative">
            <span
              aria-hidden
              className={`absolute -left-7 top-1.5 size-4 rounded-full border-2 border-[var(--s4ds-void)] ${accentFill(accentAt(index))}`}
            />
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--s4ds-ink-dim)]">
              {month} {day}
            </p>
            <Link
              href={`/${event.slug}`}
              className="mt-0.5 inline-block text-lg font-black tracking-[-0.015em] underline-offset-4 transition-colors hover:text-[var(--s4ds-yellow)] hover:underline"
            >
              {event.title}
            </Link>
            {event.tagline ? (
              <p className="mt-0.5 max-w-[62ch] text-sm leading-snug text-[var(--s4ds-ink-dim)]">
                {event.tagline}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default async function Home() {
  const { open, upcoming, past } = await getHomepageEvents();
  const isEmpty = open.length === 0 && upcoming.length === 0 && past.length === 0;

  return (
    <main>
      <section className="s4ds-grid border-b-2 border-[var(--s4ds-ink)]/15">
        <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-14 sm:pb-20 sm:pt-20">
          <h1 className="text-[clamp(2.5rem,8.5vw,5.25rem)] font-black uppercase leading-[0.95] tracking-[-0.03em]">
            <span className="block">Workshops,</span>
            <span className="block">Hackathons</span>
            <span className="block">
              &amp; <Slab accent="yellow">Sessions</Slab>
            </span>
          </h1>

          <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-[var(--s4ds-ink-dim)] text-pretty">
            Everything the Society for Data Science runs at KJSIT register,
            get your QR, walk in.
          </p>

          {open.length > 0 ? (
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <Chip accent="orange">
                {open.length} open now
              </Chip>
              {upcoming.length > 0 ? <Chip>{upcoming.length} coming up</Chip> : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl space-y-16 px-5 py-16">
        {open.length > 0 ? (
          <section>
            <SectionHeading accent="orange" count={open.length}>
              Open for registration
            </SectionHeading>
            <ul className="mt-6 space-y-5">
              {open.map((event, index) => (
                <EventRow
                  key={event.id}
                  event={event}
                  accent={accentAt(index)}
                  index={index}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {upcoming.length > 0 ? (
          <section>
            <SectionHeading accent="peri" count={upcoming.length}>
              Coming up
            </SectionHeading>
            <p className="mt-2 text-sm text-[var(--s4ds-ink-dim)]">
              Registration hasn&apos;t opened yet. Open the event for the date it does.
            </p>
            <ul className="mt-6 space-y-5">
              {upcoming.map((event, index) => (
                <EventRow
                  key={event.id}
                  event={event}
                  accent={accentAt(index + open.length)}
                  index={index}
                  dimmed
                />
              ))}
            </ul>
          </section>
        ) : null}

        {past.length > 0 ? (
          <section>
            <SectionHeading accent="purple" count={past.length}>
              Already happened
            </SectionHeading>
            <PastTimeline events={past} />
          </section>
        ) : null}

        {isEmpty ? (
          <div className="rounded-[var(--s4ds-r)] border-[3px] border-dashed border-[var(--s4ds-ink)]/30 px-6 py-16 text-center">
            <p className="text-xl font-black">Nothing published yet</p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[var(--s4ds-ink-dim)] text-pretty">
              The next workshop or hackathon shows up here the moment it goes
              live. Follow S4DS in the meantime.
            </p>
            <a
              href="https://s4ds.kjsit.org/"
              className="mt-6 inline-block font-bold text-[var(--s4ds-yellow)] underline underline-offset-4"
            >
              s4ds.kjsit.org
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}
