import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

/**
 * Called every minute by netlify/functions/process-emails.ts.
 *
 * Netlify's function timeout is short (~10s default) and Gmail SMTP takes 1–2s
 * per message, so we take a small batch and let the next run pick up the rest.
 */
export async function POST(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await processEmailQueue(5));
  } catch (error) {
    console.error("process-emails failed:", error);
    return NextResponse.json({ error: "Could not drain the queue" }, { status: 500 });
  }
}
