import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Globe } from "lucide-react";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { getSpeakers, type Speaker } from "@/config/speakers";
import {
  getEventBySlug,
  getEventFormFields,
  formatEventDates,
  formatDayDate,
  formatFee,
} from "@/lib/events";
import { RegistrationForm } from "./RegistrationForm";
import { Chip, Panel, SectionHeading } from "@/components/s4ds";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  if (isReservedSlug(slug)) return {};

  const event = await getEventBySlug(slug);
  if (!event) return {};

  return {
    title: event.title,
    description: event.tagline ?? undefined,
  };
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;

  // Reserved slugs can't reach here in practice (a real route would win), but
  // bail explicitly so the behaviour is obvious rather than accidental.
  if (isReservedSlug(slug)) notFound();

  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const fields = getEventFormFields(event);
  const speakers = getSpeakers(slug);
  const closed = !event.registration_open;
  // Being full is no longer a closed state — it switches to `event.waitlisting`.
  const finished = new Date(event.ends_at) < new Date();
  const lowSpots =
    event.spots_left !== null && event.spots_left > 0 && event.spots_left <= 10;

  // The deposit is released on the *last* day's check-in, not the first —
  // that's the whole point of it. Spell out which day that is rather than
  // saying "when you attend", which people read as "when I show up once".
  const refundTerms = event.requires_payment
    ? event.days.length > 1
      ? `Refunded in full once you check in on Day ${event.days.length}.`
      : "Refunded in full once you check in at the door."
    : null;

  return (
    <main>
      <section className="s4ds-grid border-b-2 border-[var(--s4ds-ink)]/15">
        <div className="mx-auto w-full max-w-3xl px-5 pb-14 pt-8 sm:pb-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--s4ds-ink-dim)] underline-offset-4 transition-colors hover:text-[var(--s4ds-yellow)] hover:underline"
          >
            <span aria-hidden>←</span> All events
          </Link>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <Chip accent={event.requires_payment ? "yellow" : "green"}>
              {event.requires_payment
                ? `${formatFee(event.fee_amount)} refundable deposit`
                : "Free"}
            </Chip>
            {event.days.length > 1 ? <Chip>{event.days.length} days</Chip> : null}
            {event.spots_left !== null && !finished ? (
              event.waitlisting ? (
                <Chip accent="orange">Waitlist open</Chip>
              ) : (
                <Chip accent={lowSpots ? "orange" : undefined}>
                  {event.spots_left} spots left
                </Chip>
              )
            ) : null}
          </div>

          <h1 className="mt-5 text-[clamp(2rem,6vw,3.5rem)] font-black uppercase leading-[0.98] tracking-[-0.03em] text-balance">
            {event.title}
          </h1>

          {event.tagline ? (
            <p className="mt-4 max-w-[54ch] text-lg leading-relaxed text-[var(--s4ds-ink-dim)] text-pretty">
              {event.tagline}
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl px-5 py-12">
        <Panel className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.1em] text-[var(--s4ds-ink-invert-dim)]">
              When
            </dt>
            <dd className="mt-1 font-bold leading-snug">{formatEventDates(event)}</dd>
          </div>
          {event.venue ? (
            <div>
              <dt className="text-xs font-black uppercase tracking-[0.1em] text-[var(--s4ds-ink-invert-dim)]">
                Where
              </dt>
              <dd className="mt-1 font-bold leading-snug">{event.venue}</dd>
            </div>
          ) : null}
        </Panel>

        {event.days.length > 1 ? (
          <ul className="mt-5 overflow-hidden rounded-[var(--s4ds-r)] border-2 border-[var(--s4ds-ink)]/20">
            {event.days.map((day) => (
              <li
                key={day.id}
                className="flex items-baseline justify-between gap-4 border-b-2 border-[var(--s4ds-ink)]/15 px-4 py-3 text-sm last:border-b-0"
              >
                <span className="font-bold">{day.label ?? `Day ${day.day_number}`}</span>
                <span className="text-[var(--s4ds-ink-dim)]">{formatDayDate(day.date)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {event.description ? (
          <div className="mt-12 space-y-4 leading-relaxed">
            {renderDescription(event.description)}
          </div>
        ) : null}

        {speakers.length > 0 ? (
          <section className="mt-14">
            <SectionHeading accent="peri" count={speakers.length}>
              {speakers.length === 1 ? "Speaker" : "Speakers"}
            </SectionHeading>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2">
              {speakers.map((speaker) => (
                <li key={speaker.linkedin}>
                  <SpeakerCard speaker={speaker} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="register" className="mt-14 scroll-mt-20">
          {closed ? (
            <div className="rounded-[var(--s4ds-r)] border-[3px] border-dashed border-[var(--s4ds-ink)]/30 px-6 py-12 text-center">
              <p className="text-xl font-black">
                {finished ? "This event has finished" : "Registration is not open"}
              </p>
              <p className="mx-auto mt-2 max-w-[46ch] text-[var(--s4ds-ink-dim)] text-pretty">
                {finished
                  ? "Thanks to everyone who came."
                  : event.registration_opens_at
                    ? `Opens ${formatDayDate(event.registration_opens_at)}.`
                    : "Check back soon."}
              </p>
              <Link
                href="/"
                className="mt-6 inline-block font-bold text-[var(--s4ds-yellow)] underline underline-offset-4"
              >
                See what else is on
              </Link>
            </div>
          ) : (
            <>
              <SectionHeading accent="yellow">
                {event.waitlisting ? "Join the waitlist" : "Register"}
              </SectionHeading>

              {event.waitlisting ? (
                <p className="mt-5 rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-orange)] bg-[color-mix(in_srgb,var(--s4ds-orange)_12%,transparent)] px-4 py-3 text-sm leading-relaxed">
                  <strong className="font-black">All {event.capacity} seats are taken.</strong>{" "}
                  You can still sign up. You&apos;ll go on the waitlist and we&apos;ll contact you
                  if a seat opens up. {event.requires_payment ? "Don't pay anything yet." : null}
                </p>
              ) : null}

              {refundTerms && !event.waitlisting ? (
                <p className="mt-5 rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-yellow)] bg-[color-mix(in_srgb,var(--s4ds-yellow)_12%,transparent)] px-4 py-3 text-sm leading-relaxed">
                  <strong className="font-black">
                    {formatFee(event.fee_amount)} deposit, not a fee.
                  </strong>{" "}
                  {refundTerms} 
                  <br/> It only exists so seats don&apos;t go to no-shows.
                </p>
              ) : null}

              <Panel className="mt-6 p-5 sm:p-7">
                <RegistrationForm
                  slug={event.slug}
                  fields={fields}
                  // Full: skip the payment step entirely — the deposit is
                  // collected on promotion, not for a place in the queue.
                  requiresPayment={event.requires_payment && !event.waitlisting}
                  waitlisting={event.waitlisting}
                  feeLabel={formatFee(event.fee_amount)}
                  refundTerms={refundTerms}
                  paymentQrUrl={event.payment_qr_url}
                />
              </Panel>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

/** Lucide dropped brand marks, so the LinkedIn glyph is inlined. */
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

/**
 * Icon-only, so the accessible name has to carry the speaker's name too —
 * "LinkedIn" on its own is four identical links to a screen reader.
 */
function SpeakerLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="grid size-9 place-items-center rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-edge)] bg-[var(--s4ds-bone)] text-[var(--s4ds-ink-invert)] shadow-[var(--s4ds-shadow-press)] transition-[transform,box-shadow,background-color] duration-150 ease-[var(--s4ds-ease)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[var(--s4ds-yellow)] hover:shadow-[var(--s4ds-shadow)] active:translate-x-0 active:translate-y-0 active:shadow-none"
    >
      {children}
    </a>
  );
}

/**
 * Two destinations now, so the card can't be one link any more. The photo and
 * name are plain content and the icons carry the navigation.
 */
function SpeakerCard({ speaker }: { speaker: Speaker }) {
  return (
    <Panel className="flex h-full items-center gap-4 p-4">
      <Image
        src={speaker.photo}
        alt={`${speaker.name}, speaking at this event`}
        width={160}
        height={160}
        className="size-16 shrink-0 rounded-[var(--s4ds-r-sm)] border-[3px] border-[var(--s4ds-edge)] object-cover sm:size-20"
      />
      <div className="min-w-0">
        <p className="text-lg font-black leading-tight tracking-[-0.015em] text-balance">
          {speaker.name}
        </p>
        {speaker.role ? (
          <p className="mt-1 text-sm font-normal leading-snug text-[var(--s4ds-ink-invert-dim)] text-pretty">
            {speaker.role}
          </p>
        ) : null}
        <div className="mt-2.5 flex items-center gap-2">
          <SpeakerLink
            href={speaker.linkedin}
            label={`${speaker.name} on LinkedIn`}
          >
            <LinkedInIcon />
          </SpeakerLink>
          {speaker.portfolio ? (
            <SpeakerLink
              href={speaker.portfolio}
              label={`${speaker.name}'s portfolio`}
            >
              <Globe className="size-4" />
            </SpeakerLink>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/**
 * Minimal markdown: paragraphs, bullets, **bold** and `code`. Enough for event
 * descriptions without pulling in a renderer and sanitizer.
 */
function renderDescription(markdown: string) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="ml-5 max-w-[68ch] list-disc space-y-1.5 text-[var(--s4ds-ink-dim)] marker:text-[var(--s4ds-yellow)]">
        {list.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  markdown.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      list.push(trimmed.slice(2));
      return;
    }
    flushList(`list-${index}`);
    if (trimmed) {
      blocks.push(
        <p key={index} className="max-w-[68ch] text-[var(--s4ds-ink-dim)] text-pretty">
          {inline(trimmed)}
        </p>,
      );
    }
  });

  flushList("list-end");
  return blocks;
}

function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-bold text-[var(--s4ds-ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-[var(--s4ds-r-sm)] bg-[var(--s4ds-carbon)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--s4ds-ink)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
