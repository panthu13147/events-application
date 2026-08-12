import { NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/auth";
import { scanSchema } from "@/lib/validation";
import { checkIn } from "@/lib/scan";

/** Check in by scanned QR (which carries `qr_token`). */
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

  const parsed = scanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ result: "NOT_FOUND" }, { status: 404 });
  }

  const outcome = await checkIn(
    { by: "qr_token", value: parsed.data.qr_token },
    parsed.data.event_day_id,
    scannedBy,
  );

  return NextResponse.json(outcome.body, { status: outcome.status });
}
