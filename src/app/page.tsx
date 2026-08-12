import Link from "next/link";
import { getHomepageEvents, formatEventDates, formatFee } from "@/lib/events";
import type { Event } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "S4DS Events — KJSIT",
  description: "Workshops, hackathons and sessions by S4DS, KJSIT.",
};

function EventCard({ event, past = false }: { event: Event; past?: boolean }) {
  return (
    <Link
      href={`/${event.slug}`}
      className="group block rounded-xl border bg-card p-5 transition-colors hover:border-foreground/25"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight group-hover:underline">{event.title}</h3>
          {event.tagline ? (
            <p className="mt-1 text-sm text-muted-foreground">{event.tagline}</p>
          ) : null}
        </div>
        {!past ? (
          <Badge variant={event.requires_payment ? "secondary" : "outline"} className="shrink-0">
            {formatFee(event.fee_amount)}
          </Badge>
        ) : null}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <dd>{formatEventDates(event)}</dd>
        {event.venue ? <dd>{event.venue}</dd> : null}
      </dl>
    </Link>
  );
}

function Section({
  title,
  hint,
  events,
  past = false,
}: {
  title: string;
  hint?: string;
  events: Event[];
  past?: boolean;
}) {
  if (events.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className={past ? "grid gap-3 opacity-75 sm:grid-cols-2" : "grid gap-3"}>
        {events.map((event) => (
          <EventCard key={event.id} event={event} past={past} />
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const { open, upcoming, past } = await getHomepageEvents();
  const isEmpty = open.length === 0 && upcoming.length === 0 && past.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <header className="mb-12">
        <p className="text-sm font-medium text-muted-foreground">S4DS · KJSIT</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Events</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Workshops, hackathons and sessions run by the Society for Data Science.
        </p>
      </header>

      <div className="space-y-12">
        <Section title="Open for registration" events={open} />
        <Section title="Upcoming" hint="registration not open yet" events={upcoming} />
        <Section title="Past" events={past} past />
      </div>

      {isEmpty ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No events published yet.
        </p>
      ) : null}
    </main>
  );
}
