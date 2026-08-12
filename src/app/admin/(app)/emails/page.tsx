import { db } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { DrainButton, RetryButton } from "./QueueActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Email queue" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  SENT: "default",
  QUEUED: "secondary",
  SENDING: "outline",
  FAILED: "destructive",
};

const TEMPLATE_LABEL: Record<string, string> = {
  confirmation: "Registered",
  waitlisted: "Waitlisted",
  approved: "You're in",
  rejected: "Rejected",
  ticket: "Ticket resend",
};

function when(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default async function EmailQueuePage() {
  const [{ data: jobs, error }, { data: all }] = await Promise.all([
    db
      .from("email_jobs")
      .select("id, to, template, status, attempts, last_error, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("email_jobs").select("status"),
  ]);

  if (error) throw error;

  const counts = (all ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const queued = (counts.QUEUED ?? 0) + (counts.SENDING ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email queue</h1>
          <p className="text-sm text-muted-foreground">
            Mail is never sent inside a request. It queues here and a worker
            sends it. In production that runs every minute on its own.
          </p>
        </div>
        <DrainButton queued={queued} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["QUEUED", "SENDING", "SENT", "FAILED"] as const).map((status) => (
          <span
            key={status}
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
          >
            {status.toLowerCase()}
            <span className="ml-1.5 font-medium tabular-nums text-foreground">
              {counts[status] ?? 0}
            </span>
          </span>
        ))}
      </div>

      {!jobs?.length ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing has been queued yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3"
            >
              <Badge variant={STATUS_VARIANT[job.status] ?? "outline"} className="shrink-0">
                {job.status}
              </Badge>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{job.to}</p>
                <p className="text-xs text-muted-foreground">
                  {TEMPLATE_LABEL[job.template] ?? job.template} · queued {when(job.created_at)}
                  {job.sent_at ? ` · sent ${when(job.sent_at)}` : ""}
                  {job.attempts > 1 ? ` · ${job.attempts} attempts` : ""}
                </p>
                {job.last_error ? (
                  <p className="mt-1 break-words text-xs text-destructive">{job.last_error}</p>
                ) : null}
              </div>

              {job.status === "FAILED" ? <RetryButton id={job.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
