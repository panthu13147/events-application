import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, AuthError } from "@/lib/auth";
import { checkIn } from "@/lib/scan";

const schema = z.object({
  code: z.string().trim().min(3).toUpperCase(),
  event_day_id: z.string().min(1),
});

/**
 * Manual fallback for when the camera won't cooperate — the volunteer types the
 * code printed on the ticket. Same outcomes as the QR route.
 */
export async function POST(request: Request) {
  let scannedBy: string;
  try {
    scannedBy = (await requireRole("SCANNER")).sub;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ result: "NOT_FOUND" }, { status: 404 });
  }

  const outcome = await checkIn(
    { by: "code", value: parsed.data.code },
    parsed.data.event_day_id,
    scannedBy,
  );

  return NextResponse.json(outcome.body, { status: outcome.status });
}
