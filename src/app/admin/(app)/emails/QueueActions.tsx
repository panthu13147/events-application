"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DrainButton({ queued }: { queued: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function drain() {
    setBusy(true);
    setResult(null);

    const response = await fetch("/api/admin/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "drain" }),
    });

    const body = await response.json().catch(() => ({}));
    setResult(
      response.ok
        ? body.claimed === 0
          ? "Queue was already empty"
          : `Sent ${body.sent}${body.failed ? `, ${body.failed} failed` : ""}`
        : (body.error ?? "Could not send"),
    );

    startTransition(() => {
      router.refresh();
      setBusy(false);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {result ? <span className="text-sm text-muted-foreground">{result}</span> : null}
      <Button onClick={drain} disabled={busy || pending || queued === 0} className="gap-2">
        <Send className="size-4" />
        {busy ? "Sending…" : queued > 0 ? `Send ${queued} now` : "Nothing queued"}
      </Button>
    </div>
  );
}

export function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry", id }),
        });
        router.refresh();
        setBusy(false);
      }}
    >
      <RefreshCw className="size-3.5" />
      {busy ? "…" : "Retry"}
    </Button>
  );
}
