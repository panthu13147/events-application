import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { generateCertificatePdf } from "@/lib/certificates/generate";

/**
 * Renders one certificate and returns it inline, so the admin can look at the
 * thing before it lands in somebody's inbox. Nothing is queued or recorded —
 * this is the same generator the worker uses, called for a look.
 *
 * The name is read from the database rather than taken from the query string:
 * whatever is drawn here has to be exactly what the real send would draw, and a
 * name parameter would only ever preview a fiction.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const registrationId = request.nextUrl.searchParams.get("registrationId");

  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required" }, { status: 400 });
  }

  const { data: registration, error } = await db
    .from("registrations")
    .select("full_name, events!inner(title)")
    .eq("id", registrationId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // The event title is the one thing on the certificate that varies per event,
  // so the preview has to carry it or it isn't previewing the real thing.
  const event = registration.events as unknown as { title?: string } | null;

  const pdf = await generateCertificatePdf(registration.full_name, {
    eventTitle: event?.title,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline, not attachment — the point is to look at it, not download it.
      "Content-Disposition": `inline; filename="certificate-preview.pdf"`,
      // Someone's name on a certificate is not something to leave in a proxy.
      "Cache-Control": "no-store",
    },
  });
}
