import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase";

const BUCKET = "payment-proofs";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Payment screenshots go to a PRIVATE Supabase Storage bucket — they're photos
 * of people's payment apps, so nothing here is publicly listable. Admins view
 * them through a short-lived signed URL.
 *
 * The client compresses to ~1200px before sending, so these are small.
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

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${slug}/${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) {
    console.error("payment proof upload failed:", error);
    return NextResponse.json(
      { error: "Could not upload the image. Please try again." },
      { status: 500 },
    );
  }

  // The stored value is a bucket path, not a URL — the bucket is private.
  return NextResponse.json({ url: path });
}
