import { NextResponse } from "next/server";
import { uploadPaymentProof } from "@/lib/cloudinary";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Payment screenshot upload.
 *
 * The client compresses to ~1200px before sending, so these are small enough to
 * pass through a Netlify function comfortably. What's stored on the
 * registration is a Cloudinary public_id, not a URL — the asset is uploaded as
 * `authenticated` and can only be viewed through a signed URL.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const slug = form?.get("slug");

  if (!(file instanceof File) || typeof slug !== "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG or WebP image" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  // Keep the folder to a known-safe shape — `slug` arrives from the client.
  const folder = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || "unknown";

  try {
    const publicId = await uploadPaymentProof(
      Buffer.from(await file.arrayBuffer()),
      file.type,
      folder,
    );
    return NextResponse.json({ url: publicId });
  } catch (error) {
    console.error("payment proof upload failed:", error);
    return NextResponse.json(
      { error: "Could not upload the image. Please try again." },
      { status: 500 },
    );
  }
}
