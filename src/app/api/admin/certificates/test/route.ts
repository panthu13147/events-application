import { NextResponse } from "next/server";
import { generateCertificatePdf } from "@/lib/certificates/generate";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name") || "Panth Shah";
  
  try {
    const pdfBytes = await generateCertificatePdf(name);
    
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=test-cert.pdf"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
