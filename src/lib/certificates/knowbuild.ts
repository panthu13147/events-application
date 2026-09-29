import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

const BG_PATH = path.join(process.cwd(), "src/lib/certificates/assets/knowbuild-bg.jpg");
const PAGE = { width: 1200, height: 800 }; 

// We guess the coordinates based on typical rendering of certificate.css
// The participant-line is a 500px span inside a centered flex container
// team-line is a 480px span below it.
// We will refine these coordinates manually if needed.
const NAME_SLOT = { xCenter: 700, yFromTop: 426, fontSize: 30 };
const TEAM_SLOT = { xCenter: 334, yFromTop: 474, fontSize: 30 };

export async function generateKnowbuildCertificatePdf(participantName: string, teamName: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);

  let bgBytes;
  try {
    bgBytes = await fs.readFile(BG_PATH);
  } catch (e) {
    console.error("Knowbuild background image not found at", BG_PATH);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawText(`Certificate for ${participantName}`, {
      x: 100,
      y: PAGE.height - 200,
      size: 40,
      font,
      color: rgb(0, 0, 0),
    });
    if (teamName) {
      page.drawText(`Team: ${teamName}`, {
        x: 100,
        y: PAGE.height - 250,
        size: 30,
        font,
        color: rgb(0, 0, 0),
      });
    }
    return pdfDoc.save();
  }

  const bg = await pdfDoc.embedJpg(bgBytes);
  page.drawImage(bg, { x: 0, y: 0, width: PAGE.width, height: PAGE.height });

  const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  let nameSize = NAME_SLOT.fontSize;
  while (font.widthOfTextAtSize(participantName, nameSize) > 460 && nameSize > 16) {
    nameSize -= 0.5;
  }
  const textWidth = font.widthOfTextAtSize(participantName, nameSize);
  page.drawText(participantName, {
    x: NAME_SLOT.xCenter - textWidth / 2,
    y: PAGE.height - NAME_SLOT.yFromTop,
    size: nameSize,
    font,
    color: rgb(0.05, 0.05, 0.05),
  });

  if (teamName) {
    let teamSize = TEAM_SLOT.fontSize;
    while (font.widthOfTextAtSize(teamName, teamSize) > 440 && teamSize > 14) {
      teamSize -= 0.5;
    }
    const teamWidth = font.widthOfTextAtSize(teamName, teamSize);
    page.drawText(teamName, {
      x: TEAM_SLOT.xCenter - teamWidth / 2,
      y: PAGE.height - TEAM_SLOT.yFromTop,
      size: teamSize,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
  }

  return pdfDoc.save();
}
