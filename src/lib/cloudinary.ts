import "server-only";
import { randomUUID } from "crypto";
import { v2 as cloudinary } from "cloudinary";

/**
 * SERVER ONLY.
 *
 * Uploads are signed with the API secret rather than using an unsigned preset.
 * An unsigned preset name is visible in the browser bundle, so anyone who reads
 * the JS can upload arbitrary files into the account. Since the client already
 * compresses screenshots to ~200KB, routing them through our own handler costs
 * nothing and keeps uploads authenticated.
 */

let configured = false;

function client() {
  if (!configured) {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME || "dummy_cloud";
    const api_key = process.env.CLOUDINARY_API_KEY || "dummy_key";
    const api_secret = process.env.CLOUDINARY_API_SECRET || "dummy_secret";

    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    configured = true;
  }
  return cloudinary;
}

const PROOF_FOLDER = "s4ds/payment-proofs";

/**
 * Payment screenshots are uploaded as `authenticated`, so the delivery URL only
 * works when signed. These are photos of people's payment apps — a guessable
 * public URL would be a privacy leak.
 *
 * Returns the public_id, which is what gets stored in
 * `registrations.payment_proof_url`. Use getPaymentProofUrl() to display it.
 */
export async function uploadPaymentProof(
  buffer: Buffer,
  mimeType: string,
  slug: string,
): Promise<string> {
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const result = await client().uploader.upload(dataUri, {
    folder: `${PROOF_FOLDER}/${slug}`,
    resource_type: "image",
    type: "authenticated",
    // Cap it server-side too — a client can always skip our compression.
    transformation: [{ width: 1400, height: 1400, crop: "limit", quality: "auto:good" }],
  });

  return result.public_id;
}

/** Short-lived signed URL for showing a proof in the admin table. */
export function getPaymentProofUrl(publicId: string): string {
  return client().url(publicId, {
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}

const DOCUMENT_FOLDER = "s4ds/idea-documents";

/**
 * Idea proposal / project document uploads (PDF).
 *
 * Uploaded `authenticated`, same as a payment proof — NOT because the content
 * is sensitive, but because Cloudinary blocks unauthenticated delivery of
 * raw PDF/ZIP files by default (a 2024 anti-abuse default: 401 Unauthorized
 * on the plain `secure_url`, even though the upload itself succeeds). That
 * default is a per-account toggle under Settings -> Security, off by default
 * for every account created since — signing the URL sidesteps needing that
 * toggle changed at all.
 *
 * Returns the public_id, which is what gets stored in `answers`. Use
 * getIdeaDocumentUrl() to turn it into something openable.
 */
export async function uploadIdeaDocument(
  buffer: Buffer,
  mimeType: string,
  slug: string,
): Promise<string> {
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const result = await client().uploader.upload(dataUri, {
    folder: `${DOCUMENT_FOLDER}/${slug}`,
    resource_type: "raw",
    type: "authenticated",
    // A `raw` resource has no format of its own — without an extension on the
    // public_id, the delivery URL ends in an opaque id (".../qi7rc680gr4vn7")
    // and browsers download it instead of opening it, since there's nothing
    // to tell them it's a PDF. Setting the public_id ourselves, ending in
    // ".pdf", is more reliable than `use_filename` (unicode/odd filenames,
    // or a client that doesn't send one at all).
    public_id: `${randomUUID()}.pdf`,
  });

  return result.public_id;
}

/** Signed URL for opening an idea proposal document. */
export function getIdeaDocumentUrl(publicId: string): string {
  return client().url(publicId, {
    resource_type: "raw",
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}
