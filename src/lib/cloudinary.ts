import "server-only";
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
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;

    if (!cloud_name || !api_key || !api_secret) {
      throw new Error(
        "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set.",
      );
    }

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
