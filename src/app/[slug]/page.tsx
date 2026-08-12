import { notFound } from "next/navigation";
import Link from "next/link";
import { isReservedSlug } from "@/lib/reserved-slugs";
import {
  getEventBySlug,
  getEventFormFields,
  formatEventDates,
  formatDayDate,
  formatFee,
} from "@/lib/events";
import { RegistrationForm } from "./RegistrationForm";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  if (isReservedSlug(slug)) return {};

  const event = await getEventBySlug(slug);
  if (!event) return {};

  return {
    title: `${event.title} — S4DS KJSIT`,
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
  const closed = !event.registration_open;
  const full = event.spots_left !== null && event.spots_left <= 0;
  const finished = new Date(event.ends_at) < new Date();

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        ← All events
      </Link>

      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={event.requires_payment ? "secondary" : "outline"}>
            {formatFee(event.fee_amount)}
            {event.requires_payment ? " · refundable" : ""}
          </Badge>
          {event.days.length > 1 ? (
            <Badge variant="outline">{event.days.length} days</Badge>
          ) : null}
          {event.spots_left !== null && !finished && event.spots_left > 0 ? (
            <Badge variant="outline">{event.spots_left} spots left</Badge>
          ) : null}
        </div>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{event.title}</h1>
        {event.tagline ? <p className="text-lg text-muted-foreground">{event.tagline}</p> : null}
      </header>

      <dl className="mt-8 grid gap-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">When</dt>
          <dd className="mt-0.5 font-medium">{formatEventDates(event)}</dd>
        </div>
        {event.venue ? (
          <div>
            <dt className="text-muted-foreground">Where</dt>
            <dd className="mt-0.5 font-medium">{event.venue}</dd>
          </div>
        ) : null}
      </dl>

      {event.days.length > 1 ? (
        <ul className="mt-4 space-y-2">
          {event.days.map((day) => (
            <li
              key={day.id}
              className="flex items-baseline justify-between gap-4 rounded-lg border px-4 py-3 text-sm"
            >
              <span className="font-medium">{day.label ?? `Day ${day.day_number}`}</span>
              <span className="text-muted-foreground">{formatDayDate(day.date)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {event.description ? (
        <div className="mt-10 space-y-3 text-sm leading-relaxed">
          {renderDescription(event.description)}
        </div>
      ) : null}

      <section id="register" className="mt-12 border-t pt-10">
        {closed ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">
              {finished
                ? "This event has finished"
                : full
                  ? "Registration is full"
                  : "Registration is not open"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {finished
                ? "Thanks to everyone who came."
                : full
                  ? "All spots have been taken. Watch the S4DS channels for the next one."
                  : event.registration_opens_at
                    ? `Opens ${formatDayDate(event.registration_opens_at)}.`
                    : "Check back soon."}
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-6 text-xl font-semibold tracking-tight">Register</h2>
            <RegistrationForm
              slug={event.slug}
              fields={fields}
              requiresPayment={event.requires_payment}
              feeLabel={formatFee(event.fee_amount)}
              paymentQrUrl={event.payment_qr_url}
            />
          </>
        )}
      </section>
    </main>
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
      <ul key={key} className="ml-5 list-disc space-y-1 text-muted-foreground">
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
        <p key={index} className="text-muted-foreground">
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
        <strong key={index} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
