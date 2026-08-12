"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * Encodes `qr_token`, never `code`.
 *
 * `code` is short and shown on screen — if the QR contained it, anyone could
 * generate a working ticket from a photo of someone else's. The token is 32
 * random bytes and appears nowhere else.
 */
export function TicketQR({ token }: { token: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <QRCodeSVG value={token} size={208} level="M" marginSize={0} />
    </div>
  );
}
