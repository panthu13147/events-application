import { randomBytes, randomInt } from "node:crypto";

/** Excludes I, O, 0, 1 — students read these off a screen and type them. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * The public, human-friendly registration id: KJS-7F3A9C.
 * Shown on the ticket, searchable in admin, safe to say out loud.
 */
export function generateCode(prefix = "KJS"): string {
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${prefix}-${body}`;
}

/**
 * What the QR actually encodes.
 *
 * This must be unguessable. If the QR contained `code` (or a sequential id),
 * anyone could generate a valid-looking ticket and be marked present — the
 * scanner has no other way to tell a real ticket from a forged one.
 */
export function generateQrToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Certificate serial: S4DS/2026/LLM/0042 */
export function certificateSerial(
  eventCode: string,
  year: number,
  sequence: number,
): string {
  return `S4DS/${year}/${eventCode.toUpperCase()}/${String(sequence).padStart(4, "0")}`;
}
