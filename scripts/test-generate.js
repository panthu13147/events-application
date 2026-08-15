const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("node:fs/promises");
const path = require("node:path");

const BG_PATH = path.join(process.cwd(), "src/lib/certificates/assets/certificate-bg.jpg");
const PAGE = { width: 1024, height: 723 };

const NAME_SLOT = { xCenter: 610, yFromTop: 320, fontSize: 30 };

async function generateCertificatePdf(participantName) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);

  let bgBytes = await fs.readFile(BG_PATH);
  const bg = await pdfDoc.embedJpg(bgBytes);
  page.drawImage(bg, { x: 0, y: 0, width: PAGE.width, height: PAGE.height });

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textWidth = font.widthOfTextAtSize(participantName, NAME_SLOT.fontSize);

  page.drawText(participantName, {
    x: NAME_SLOT.xCenter - textWidth / 2,
    y: PAGE.height - NAME_SLOT.yFromTop,
    size: NAME_SLOT.fontSize,
    font,
    color: rgb(0.05, 0.05, 0.05),
  });

  return pdfDoc.save();
}

module.exports = { generateCertificatePdf };

if (require.main === module) {
  generateCertificatePdf("Panth Shah").then(bytes => {
      console.log("SUCCESS, generated PDF bytes:", bytes.length);
  }).catch(console.error);
}
