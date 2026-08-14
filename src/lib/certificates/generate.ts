import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

// Using the actual certificate photo as the PDF background — it already has the
// real logos + real signatures baked in, so there's nothing left to recreate.
// Only the name gets drawn on top at generation time.
const BG_PATH = path.join(process.cwd(), "src/lib/certificates/assets/certificate-bg.jpg");
const PAGE = { width: 1024, height: 723 }; // matches certificate-bg's native size exactly

// Eyeballed against that 1024x723 photo. Run `npx tsx scripts/test-certificate.ts`,
// open the PDF, and nudge these two numbers until the name centers on the blank
// line — then leave them alone, they don't change per-certificate.
const NAME_SLOT = { xCenter: 610, yFromTop: 320, fontSize: 30 };

export async function generateCertificatePdf(participantName: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);

  let bgBytes;
  try {
    bgBytes = await fs.readFile(BG_PATH);
  } catch (e) {
    // If the image is not found, we create a blank PDF for testing so the app doesn't crash
    console.error("Certificate background image not found at", BG_PATH, e);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawText(`Certificate for ${participantName}`, {
      x: 100,
      y: PAGE.height - 200,
      size: 50,
      font,
      color: rgb(0, 0, 0),
    });
    return pdfDoc.save();
  }

  const bg = await pdfDoc.embedJpg(bgBytes);
  page.drawImage(bg, { x: 0, y: 0, width: PAGE.width, height: PAGE.height });

  // Standard font for now so this runs with zero extra setup.
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const textWidth = font.widthOfTextAtSize(participantName, NAME_SLOT.fontSize);

  page.drawText(participantName, {
    x: NAME_SLOT.xCenter - textWidth / 2,
    // pdf-lib's y-axis is bottom-up; NAME_SLOT.yFromTop was measured from the top of the image.
    y: PAGE.height - NAME_SLOT.yFromTop,
    size: NAME_SLOT.fontSize,
    font,
    color: rgb(0.05, 0.05, 0.05),
  });

  return pdfDoc.save();
}
