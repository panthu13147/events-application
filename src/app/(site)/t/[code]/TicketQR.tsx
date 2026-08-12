"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * Encodes `qr_token`, never `code`.
 *
 * `code` is short and shown on screen — if the QR contained it, anyone could
 * generate a working ticket from a photo of someone else's. The token is 32
 * random bytes and appears nowhere else.
 *
 * Kept on plain white with a hard black edge: scanners want maximum module
 * contrast, and it happens to be exactly the brand's treatment anyway.
 */
export function TicketQR({ token }: { token: string }) {
  return (
    <div className="rounded-[var(--s4ds-r-sm)] border-[3px] border-[var(--s4ds-edge)] bg-white p-4">
      <QRCodeSVG value={token} size={208} level="M" marginSize={0} />
    </div>
  );
}
