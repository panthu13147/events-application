import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { db } from "@/lib/supabase";
import { getFormFields } from "@/config/forms";
import { getPaymentProofUrl } from "@/lib/cloudinary";
import { formatEventDates } from "@/lib/events";
import { Badge } from "@/components/ui/badge";
import { RegistrationsTable, type Row } from "./RegistrationsTable";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "PENDING", label: "Needs review" },
  { key: "APPROVED", label: "Approved" },
  // Ordered by seniority, so promoting from the top of this list is fair.
  { key: "WAITLISTED", label: "Waitlist" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

function parseFilter(value: string | undefined): Filter {
  return FILTERS.some((f) => f.key === value) ? (value as Filter) : "PENDING";
}

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ status?: string }> };

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const { data } = await db.from("events").select("title").eq("slug", slug).maybeSingle();
  return { title: data?.title ?? "Event" };
}

export default async function EventRegistrationsPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const filter = parseFilter((await searchParams).status);

  const { data: event, error: eventError } = await db
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (eventError) throw eventError;
  if (!event) notFound();

  let query = db
    .from("registrations")
    .select("id, code, full_name, email, phone, status, created_at, answers, payment_proof_url")
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });

  if (filter !== "ALL") query = query.eq("status", filter);

  const [{ data: registrations, error }, { data: allForCounts }] = await Promise.all([
    query,
    db.from("registrations").select("status").eq("event_id", event.id),
  ]);

  if (error) throw error;

  const counts = (allForCounts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    acc.ALL = (acc.ALL ?? 0) + 1;
    return acc;
  }, {});

  // Signing happens here, on the server — the API secret never leaves it, and
  // the browser only ever sees a short-lived URL.
  const rows: Row[] = (registrations ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    created_at: row.created_at,
    answers: (row.answers ?? {}) as Record<string, string>,
    proof_url: row.payment_proof_url ? getPaymentProofUrl(row.payment_proof_url) : null,
  }));

  const fieldKeys = getFormFields(event.form_key).map((field) => field.key);

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All events
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
            <Badge variant={event.status === "PUBLISHED" ? "default" : "secondary"}>
              {event.status}
            </Badge>
            <a
              href={`/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open the public event page"
              aria-label="Open the public event page in a new tab"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatEventDates(event)}
            {event.venue ? ` · ${event.venue}` : ""}
            {event.capacity
              ? ` · ${(counts.PENDING ?? 0) + (counts.APPROVED ?? 0)}/${event.capacity} seats taken`
              : ""}
            {counts.WAITLISTED ? ` · ${counts.WAITLISTED} waiting` : ""}
          </p>
        </div>

        <a
          href={`/api/admin/events/${event.slug}/export`}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Download className="size-4" />
          Export CSV
        </a>
      </div>

      <nav className="flex flex-wrap gap-2 border-b pb-3">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/events/${event.slug}?status=${f.key}`}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              f.key === filter ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums opacity-60">{counts[f.key] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <RegistrationsTable rows={rows} fields={fieldKeys} />
    </div>
  );
}
