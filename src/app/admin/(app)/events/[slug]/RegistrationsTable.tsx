"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type Row = {
  id: string;
  code: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  answers: Record<string, string>;
  /** Signed Cloudinary URL, or null if there's no proof on file */
  proof_url: string | null;
};

/**
 * Rejection is one of two things in practice, and both need wording the person
 * on the other end can act on. Free text would drift into one-word reasons
 * ("payment") that read as curt in an email, so the choice is fixed here and
 * the sentence travels to the template as-is.
 */
const REJECT_REASONS = [
  {
    label: "Out of capacity",
    text: "We ran out of seats for this one — more people registered than we can fit.",
  },
  {
    label: "Payment not matched",
    text: "We couldn't match a payment to your registration.",
  },
] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
  WAITLISTED: "outline",
  CANCELLED: "outline",
};

export function RegistrationsTable({ rows, fields }: { rows: Row[]; fields: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<{ url: string; name: string } | null>(null);
  // Deleting is irreversible, so the bin icon arms a confirm step rather than
  // firing straight away.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Rejecting asks which of the two reasons applies before it fires, so the
  // email says something useful instead of just "we couldn't confirm it".
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  async function setStatus(id: string, status: "APPROVED" | "REJECTED", reason?: string) {
    setBusyId(id);
    setError(null);

    const response = await fetch(`/api/admin/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not update that registration");
      setBusyId(null);
      return;
    }

    setRejectingId(null);

    // refresh() re-runs the server component so counts and filters stay honest.
    startTransition(() => {
      router.refresh();
      setBusyId(null);
    });
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);

    const response = await fetch(`/api/admin/registrations/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(
        response.status === 403
          ? "Only an OWNER can delete registrations."
          : (body.error ?? "Could not delete that registration"),
      );
      setBusyId(null);
      return;
    }

    setConfirmingId(null);
    setRejectingId(null);
    startTransition(() => {
      router.refresh();
      setBusyId(null);
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nothing here.
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((row) => {
          const busy = busyId === row.id || pending;
          return (
            <li key={row.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{row.full_name}</p>
                    <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>{row.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.email}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                  <p className="font-mono text-xs tracking-wider text-muted-foreground">
                    {row.code}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {row.proof_url ? (
                    <button
                      type="button"
                      onClick={() => setProof({ url: row.proof_url!, name: row.full_name })}
                      className="overflow-hidden rounded-md border transition-opacity hover:opacity-80"
                      title="View payment screenshot"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.proof_url}
                        alt={`Payment proof from ${row.full_name}`}
                        className="size-14 object-cover"
                      />
                    </button>
                  ) : (
                    <span className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
                      no proof
                    </span>
                  )}

                  {rejectingId === row.id ? (
                    <>
                      <span className="text-sm text-muted-foreground">Reject because…</span>
                      {REJECT_REASONS.map((reason) => (
                        <Button
                          key={reason.label}
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          title={reason.text}
                          onClick={() => setStatus(row.id, "REJECTED", reason.text)}
                        >
                          {busy ? "…" : reason.label}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setRejectingId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : confirmingId === row.id ? (
                    <>
                      <span className="text-sm text-muted-foreground">Delete permanently?</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirmingId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => remove(row.id)}
                      >
                        {busy ? "…" : "Delete"}
                      </Button>
                    </>
                  ) : (
                    <>
                      {row.status === "APPROVED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setRejectingId(row.id)}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setStatus(row.id, "REJECTED")}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => setStatus(row.id, "APPROVED")}
                          >
                            {busy ? "…" : "Approve"}
                          </Button>
                        </>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busy}
                        title={`Delete ${row.full_name}'s registration`}
                        aria-label={`Delete ${row.full_name}'s registration`}
                        onClick={() => setConfirmingId(row.id)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {fields.length > 0 ? (
                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                  {fields.map((key) => (
                    <div key={key} className="flex gap-1.5">
                      <dt className="opacity-70">{key.replace(/_/g, " ")}:</dt>
                      <dd className="font-medium text-foreground">{row.answers[key] ?? "-"}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>

      {proof ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Payment proof from ${proof.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setProof(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proof.url}
            alt={`Payment proof from ${proof.name}`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      ) : null}
    </>
  );
}
