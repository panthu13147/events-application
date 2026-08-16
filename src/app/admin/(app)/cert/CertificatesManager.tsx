"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Registration = {
  id: string;
  code: string;
  full_name: string;
  email: string;
  phone: string | null;
  cert_status?: string;
  attendance: { id: string; event_day_id: string }[];
};

type EventDay = {
  id: string;
  label: string | null;
};

export function CertificatesManager({
  event,
  eventDays,
  registrations: allRegistrations,
}: {
  event: { id: string; slug: string; title: string };
  eventDays: EventDay[];
  registrations: Registration[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<"all" | "selected" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const totalDays = eventDays.length;

  // We show everyone, but we identify who is eligible
  const isEligible = (r: Registration) => {
    if (totalDays > 0) return r.attendance.length >= totalDays;
    return true;
  };

  const eligibleRegistrations = allRegistrations.filter(isEligible);
  const registrations = allRegistrations; // show all in UI

  const allSelected = selectedIds.size === eligibleRegistrations.length && eligibleRegistrations.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleRegistrations.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const sendCertificates = async (mode: "all" | "selected") => {
    setLoading(mode);
    setMessage(null);

    const idsToSend = mode === "all" ? eligibleRegistrations.map((r) => r.id) : Array.from(selectedIds);

    if (idsToSend.length === 0) {
      setMessage({ type: "error", text: "No attendees selected." });
      setLoading(null);
      return;
    }

    try {
      const response = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          registrationIds: idsToSend,
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
        No eligible attendees found (must be approved and have attended all event days).
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-medium">
          {registrations.length} Attendees ({eligibleRegistrations.length} Eligible)
        </h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => sendCertificates("selected")}
            disabled={selectedIds.size === 0 || loading !== null}
          >
            {loading === "selected" ? "Queuing..." : `Send to Selected (${selectedIds.size})`}
          </Button>
          <Button
            variant="default"
            onClick={() => sendCertificates("all")}
            disabled={loading !== null}
          >
            {loading === "all" ? "Queuing..." : "Send to All"}
          </Button>
        </div>
      </div>

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
            </tr>
          </thead>
          <tbody className="divide-y">
            {registrations.map((row) => {
              const attendedDays = new Set(row.attendance.map(a => a.event_day_id));
              return (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    disabled={!isEligible(row)}
                    className="size-4 rounded border-gray-300 bg-background text-primary disabled:opacity-50"
                  />
                </td>
                <td className="p-3 font-mono text-xs">{row.code}</td>
                <td className="p-3">
                  <div className="font-medium text-foreground">{row.full_name}</div>
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
                <td className="p-3 text-center font-medium">
                  {attendedDays.size} / {totalDays}
                </td>
                <td className="p-3 text-muted-foreground">
                  <span className="font-mono text-xs">{row.cert_status || "PENDING"}</span>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
