import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { generateCertificatePdf } from "@/lib/certificates/generate";
import { generateKnowbuildCertificatePdf } from "@/lib/certificates/knowbuild";

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
  const memberNameParam = request.nextUrl.searchParams.get("name");

  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required" }, { status: 400 });
  }

  const { data: registration, error } = await db
    .from("registrations")
    .select("full_name, answers, events!inner(title, slug)")
    .eq("id", registrationId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const event = registration.events as unknown as { title?: string; slug?: string } | null;
  const answers = (registration.answers as Record<string, any>) || {};
  const teamName = answers.team_name || answers.Team || answers.team || "";
  const nameToUse = memberNameParam?.trim() || registration.full_name;

  let pdf: Uint8Array;
  if (event?.slug?.includes("knowbuild")) {
    pdf = await generateKnowbuildCertificatePdf(nameToUse, teamName);
  } else {
    pdf = await generateCertificatePdf(nameToUse, {
      eventTitle: event?.title,
    });
  }

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
