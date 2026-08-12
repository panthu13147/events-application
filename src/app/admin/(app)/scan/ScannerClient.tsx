"use client";

import { useCallback, useRef, useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Day = { id: string; label: string; event_title: string };

type ScanResult =
  | { result: "OK"; name: string; code: string; day_label: string }
  | { result: "DUPLICATE"; name: string; scanned_at: string | null }
  | { result: "NOT_FOUND" }
  | { result: "NOT_APPROVED"; name: string; status: string }
  | { result: "WRONG_EVENT"; name: string; event_title: string };

/** green = let them in, amber = stop and look, red = don't let them in */
const TONE = {
  OK: "bg-emerald-600",
  DUPLICATE: "bg-amber-500",
  NOT_APPROVED: "bg-amber-500",
  WRONG_EVENT: "bg-amber-500",
  NOT_FOUND: "bg-red-600",
} as const;

export function ScannerClient({ days }: { days: Day[] }) {
  const [dayId, setDayId] = useState(days[0]?.id ?? "");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Without this the same QR fires repeatedly while it sits in frame.
  const lastToken = useRef<string | null>(null);

  const submit = useCallback(
    async (qr_token: string) => {
      if (!dayId || busy) return;
      setBusy(true);

      try {
        const response = await fetch("/api/admin/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr_token, event_day_id: dayId }),
        });
        setResult((await response.json()) as ScanResult);
      } catch {
        setResult({ result: "NOT_FOUND" });
      } finally {
        setBusy(false);
      }
    },
    [dayId, busy],
  );

  const onScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      const value = codes[0]?.rawValue;
      if (!value || value === lastToken.current) return;
      lastToken.current = value;
      void submit(value);
    },
    [submit],
  );

  function clear() {
    setResult(null);
    lastToken.current = null;
  }

  if (days.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No event days to scan. Create a published event first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="day" className="text-sm font-medium">
          Scanning for
        </label>
        <select
          id="day"
          value={dayId}
          onChange={(event) => {
            setDayId(event.target.value);
            clear();
          }}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {days.map((day) => (
            <option key={day.id} value={day.id}>
              {day.event_title} - {day.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative overflow-hidden rounded-xl border bg-black">
        <Scanner
          onScan={onScan}
          onError={(error) => setCameraError(error?.message ?? "Camera unavailable")}
          formats={["qr_code"]}
          scanDelay={400}
          allowMultiple
          sound
          constraints={{ facingMode: "environment" }}
          styles={{ container: { width: "100%" } }}
        />

        {result ? (
          <button
            type="button"
            onClick={clear}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white ${TONE[result.result]}`}
          >
            <ResultBody result={result} />
            <span className="mt-4 text-xs uppercase tracking-wide opacity-80">
              Tap to scan next
            </span>
          </button>
        ) : null}
      </div>

      {cameraError ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {cameraError}. Camera needs HTTPS. Use the deploy preview URL on a phone, not
          localhost. Use the manual check-in below in the meantime.
        </p>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (manual.trim()) void submitByCode(manual.trim(), dayId, setResult, setBusy);
          setManual("");
        }}
      >
        <Input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="Manual check-in: KJS-7F3A9C"
          className="font-mono uppercase"
        />
        <Button type="submit" variant="outline" disabled={busy || !manual.trim()}>
          Check in
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Cameras fail. The manual fallback takes the code printed on the ticket.
      </p>
    </div>
  );
}

function ResultBody({ result }: { result: ScanResult }) {
  switch (result.result) {
    case "OK":
      return (
        <>
          <span className="text-5xl">✓</span>
          <span className="text-2xl font-semibold">{result.name}</span>
          <span className="text-sm opacity-90">
            {result.code} · {result.day_label}
          </span>
        </>
      );
    case "DUPLICATE":
      return (
        <>
          <span className="text-5xl">!</span>
          <span className="text-2xl font-semibold">Already checked in</span>
          <span className="text-sm opacity-90">
            {result.name}
            {result.scanned_at
              ? ` · ${new Date(result.scanned_at).toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : ""}
          </span>
        </>
      );
    case "NOT_APPROVED":
      return (
        <>
          <span className="text-5xl">!</span>
          <span className="text-2xl font-semibold">Not approved</span>
          <span className="text-sm opacity-90">
            {result.name} · {result.status}
          </span>
        </>
      );
    case "WRONG_EVENT":
      return (
        <>
          <span className="text-5xl">!</span>
          <span className="text-2xl font-semibold">Wrong event</span>
          <span className="text-sm opacity-90">
            {result.name} is registered for {result.event_title}
          </span>
        </>
      );
    default:
      return (
        <>
          <span className="text-5xl">✕</span>
          <span className="text-2xl font-semibold">Not found</span>
          <span className="text-sm opacity-90">No registration for this ticket</span>
        </>
      );
  }
}

/** Manual fallback: look the token up by the human-readable code first. */
async function submitByCode(
  code: string,
  dayId: string,
  setResult: (result: ScanResult) => void,
  setBusy: (busy: boolean) => void,
) {
  setBusy(true);
  try {
    const response = await fetch("/api/admin/scan/by-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.toUpperCase(), event_day_id: dayId }),
    });
    setResult((await response.json()) as ScanResult);
  } catch {
    setResult({ result: "NOT_FOUND" });
  } finally {
    setBusy(false);
  }
}
