import { NextResponse } from "next/server";
import { uploadIdeaDocument } from "@/lib/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf"]);

/**
 * Idea proposal / project document upload (PDF). Separate from /api/upload
 * (payment screenshots): different mime types, no client-side compression,
 * and the result is a public URL rather than a signed authenticated one — see
 * uploadIdeaDocument().
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const slug = form?.get("slug");

  if (!(file instanceof File) || typeof slug !== "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Upload a PDF file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
  }

  const folder = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || "unknown";

  try {
    const url = await uploadIdeaDocument(
      Buffer.from(await file.arrayBuffer()),
      file.type,
      folder,
    );
    return NextResponse.json({ url });
  } catch (error) {
    console.error("idea document upload failed:", error);
    return NextResponse.json(
      { error: "Could not upload the document. Please try again." },
      { status: 500 },
    );
  }
}
