"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Registration = {
  id: string;
  code: string;
  full_name: string;
  email: string;
  phone: string | null;
  cert_status?: string;
  answers?: Record<string, any>;
  attendance: { id: string; event_day_id: string }[];
};

type EventDay = {
  id: string;
  label: string | null;
};

/**
 * Queuing a certificate for someone who missed part of the event is allowed,
 * but it shouldn't be something you do by reflex — the mail goes out on the next
 * worker pass and there is no unsend. So the count gets said out loud first.
 */
function ConfirmSend({
  mode,
  count,
  partialCount,
  totalDays,
  onCancel,
  onConfirm,
}: {
  mode: "all" | "selected";
  count: number;
  partialCount: number;
  totalDays: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Confirm certificate send"
      className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm"
    >
      <p className="flex-1">
        Queue {count} {count === 1 ? "certificate" : "certificates"}
        {mode === "all" ? " for everyone listed" : ""}. {partialCount}{" "}
        {partialCount === 1 ? "person" : "people"} did not attend all {totalDays} days.
      </p>
      <Button size="sm" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" variant="destructive" onClick={onConfirm}>
        Send anyway
      </Button>
    </div>
  );
}

/** Distinct days scanned. A Set, so a duplicate row can't inflate the count. */
const attendedCount = (r: Registration) =>
  new Set(r.attendance.map((a) => a.event_day_id)).size;

export function CertificatesManager({
  event,
  eventDays,
  registrations: allRegistrations,
}: {
  event: { id: string; slug: string; title: string };
  eventDays: EventDay[];
  registrations: Registration[];
}) {
  const [deliveryMode, setDeliveryMode] = useState<"individual" | "leader_only">("individual");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<"all" | "selected" | null>(null);
  const [confirming, setConfirming] = useState<"all" | "selected" | null>(null);
  const [preview, setPreview] = useState<Registration | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const totalDays = eventDays.length;

  /**
   * Full attendance is a default, not a rule. Partial-attendance certificates
   * are a normal call to make, so this only drives the visual cue and the
   * "select everyone who came to all of it" shortcut — it never blocks a send.
   */
  const isEligible = (r: Registration) =>
    totalDays === 0 || attendedCount(r) >= totalDays;

  const eligibleRegistrations = allRegistrations.filter(isEligible);
  const registrations = allRegistrations;

  const allSelected = selectedIds.size === registrations.length && registrations.length > 0;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(registrations.map((r) => r.id)));
  };

  const selectFullyAttended = () =>
    setSelectedIds(new Set(eligibleRegistrations.map((r) => r.id)));

  // Sending is irreversible once the worker picks the job up, so a selection
  // that includes someone who missed a day has to be confirmed rather than
  // fired on the first click.
  const selected = registrations.filter((r) => selectedIds.has(r.id));
  const partial = selected.filter((r) => !isEligible(r));

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const sendCertificates = async (mode: "all" | "selected") => {
    const idsToSend =
      mode === "all" ? registrations.map((r) => r.id) : Array.from(selectedIds);

    if (idsToSend.length === 0) {
      setMessage({ type: "error", text: "No attendees selected." });
      return;
    }

    setLoading(mode);
    setMessage(null);
    setConfirming(null);

    try {
      const response = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          registrationIds: idsToSend,
          deliveryMode,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Failed to queue certificates");
      }

      setMessage({
        type: "success",
        text: `Successfully queued ${body.queued} certificates for sending!`,
      });
      // Optionally, clear selection
      if (mode === "selected") setSelectedIds(new Set());
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setLoading(null);
    }
  };



  if (registrations.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No approved registrations for this event yet.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">
            {registrations.length} attendees
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {eligibleRegistrations.length} came to every day
            </span>
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Delivery:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="deliveryMode"
                value="individual"
                checked={deliveryMode === "individual"}
                onChange={() => setDeliveryMode("individual")}
                className="size-3 text-primary"
              />
              <span>Individual (each member gets their own email)</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="deliveryMode"
                value="leader_only"
                checked={deliveryMode === "leader_only"}
                onChange={() => setDeliveryMode("leader_only")}
                className="size-3 text-primary"
              />
              <span>All certs to team leader</span>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {totalDays > 0 ? (
            <Button
              variant="ghost"
              onClick={selectFullyAttended}
              disabled={eligibleRegistrations.length === 0 || loading !== null}
            >
              Select fully attended ({eligibleRegistrations.length})
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() =>
              partial.length > 0 ? setConfirming("selected") : sendCertificates("selected")
            }
            disabled={selectedIds.size === 0 || loading !== null}
          >
            {loading === "selected" ? "Queuing..." : `Send to selected (${selectedIds.size})`}
          </Button>
          <Button
            variant="default"
            onClick={() =>
              eligibleRegistrations.length < registrations.length
                ? setConfirming("all")
                : sendCertificates("all")
            }
            disabled={registrations.length === 0 || loading !== null}
          >
            {loading === "all" ? "Queuing..." : `Send to all (${registrations.length})`}
          </Button>
        </div>
      </div>

      {confirming ? (
        <ConfirmSend
          mode={confirming}
          count={confirming === "all" ? registrations.length : selectedIds.size}
          partialCount={
            confirming === "all" ? registrations.length - eligibleRegistrations.length : partial.length
          }
          totalDays={totalDays}
          onCancel={() => setConfirming(null)}
          onConfirm={() => sendCertificates(confirming)}
        />
      ) : null}

      {message && (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            message.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-green-500/30 bg-green-500/10 text-green-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="rounded-md border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-3 font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 rounded border-gray-300 bg-background text-primary"
                />
              </th>
              <th className="p-3 font-medium text-muted-foreground">Code</th>
              <th className="p-3 font-medium text-muted-foreground">Attendee</th>
              <th className="p-3 font-medium text-muted-foreground">Contact</th>
              {eventDays.map((day, i) => (
                <th key={day.id} className="p-3 font-medium text-muted-foreground whitespace-nowrap">
                  {day.label || `Day ${i + 1}`}
                </th>
              ))}
              <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Days Attended</th>
              <th className="p-3 font-medium text-muted-foreground">Status</th>
              <th className="p-3 font-medium text-muted-foreground">
                <span className="sr-only">Preview certificate</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {registrations.map((row) => {
              const attendedDays = new Set(row.attendance.map(a => a.event_day_id));
              const teamName = row.answers?.team_name || row.answers?.Team || row.answers?.team;
              const extraMembers = [2, 3, 4]
                .map((n) => row.answers?.[`member${n}_name`]?.trim())
                .filter(Boolean);

              return (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    aria-label={`Select ${row.full_name}`}
                    className="size-4 rounded border-gray-300 bg-background text-primary"
                  />
                </td>
                <td className="p-3 font-mono text-xs">{row.code}</td>
                <td className="p-3">
                  <div className="font-medium text-foreground">{row.full_name}</div>
                  {teamName ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">Team: {teamName}</span>
                      {extraMembers.length > 0 && (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                          +{extraMembers.length} {extraMembers.length === 1 ? "member" : "members"}
                        </span>
                      )}
                    </div>
                  ) : null}
                </td>
                <td className="p-3 text-muted-foreground">
                  <div>{row.email}</div>
                  {row.phone && <div className="text-xs">{row.phone}</div>}
                </td>
                {eventDays.map((day) => (
                  <td key={day.id} className="p-3 text-center">
                    {attendedDays.has(day.id) ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : (
                      <span className="text-red-500 font-bold">✗</span>
                    )}
                  </td>
                ))}
                <td
                  className={`p-3 text-center font-medium ${
                    isEligible(row) ? "" : "text-muted-foreground"
                  }`}
                >
                  {attendedDays.size} / {totalDays}
                </td>
                <td className="p-3 text-muted-foreground">
                  <span className="font-mono text-xs">{row.cert_status || "PENDING"}</span>
                </td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => setPreview(row)}
                  >
                    <FileText className="size-3.5" />
                    Preview
                  </Button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {preview ? (
        <CertificatePreview registration={preview} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  );
}

/**
 * Shows the real PDF, generated on demand by the same code the worker runs, so
 * a name that overflows the blank line or a background that failed to load is
 * something you find here rather than in a reply-all.
 */
function CertificatePreview({
  registration,
  onClose,
}: {
  registration: Registration;
  onClose: () => void;
}) {
  const members = [
    registration.full_name,
    registration.answers?.member2_name?.trim(),
    registration.answers?.member3_name?.trim(),
    registration.answers?.member4_name?.trim(),
  ].filter(Boolean) as string[];

  const [activeName, setActiveName] = useState(members[0] || registration.full_name);
  const url = `/api/admin/certificates/preview?registrationId=${registration.id}&name=${encodeURIComponent(activeName)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Certificate preview for ${activeName}`}
      className="fixed inset-0 z-50 flex flex-col gap-3 bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-4 text-sm text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <p className="truncate font-medium">{activeName}</p>
          {members.length > 1 && (
            <div className="flex items-center gap-1.5 rounded-md bg-white/10 p-1">
              {members.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveName(m)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    activeName === m
                      ? "bg-white font-medium text-black"
                      : "text-white/80 hover:bg-white/20"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/30 px-3 py-1.5 transition-colors hover:bg-white/10"
          >
            Open in new tab
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md border border-white/30 p-1.5 transition-colors hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <iframe
        src={url}
        title={`Certificate preview for ${registration.full_name}`}
        className="min-h-0 flex-1 rounded-lg bg-white"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
