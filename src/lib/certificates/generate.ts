import "server-only";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * The certificate, drawn to match certificate-templates/certificate.html.
 *
 * That HTML is the design of record — it is what gets reviewed and what people
 * expect to receive. This file is a transcription of it, not a second design:
 * every number below comes from certificate.css, so if the two ever disagree,
 * the CSS is right and this is stale.
 *
 * It is redrawn rather than screenshotted because the output is vector — sharp
 * at any zoom, and a fraction of the file size of a full-page background image
 * on an email that goes out to hundreds of people.
 *
 * FONTS. The template's body is `"Times New Roman", Times, serif`, and Times is
 * one of PDF's fourteen built-in faces — so the participant's name is set in the
 * genuine article, not a lookalike, with no font file to ship. The one place
 * that isn't exact is the title: the template asks for Old English Text MT /
 * UnifrakturMaguntia, which is blackletter and has no base-14 equivalent, so it
 * falls back to Times Bold. Getting the real thing needs @pdf-lib/fontkit plus
 * a licensed font file committed to the repo.
 */

/**
 * Downscaled copies of certificate-templates/assets, produced by
 * `npx tsx scripts/optimize-certificate-assets.ts`. The originals are 12x
 * larger than they are ever drawn and pdf-lib embeds PNGs as given, which put
 * every emailed certificate at 2.2MB. Re-run that script after changing the
 * artwork or these will quietly go stale.
 */
const ASSETS = path.join(process.cwd(), "src/lib/certificates/assets");

/** .certificate — width/height, and the padding the content sits inside. */
const PAGE = { width: 1200, height: 800 };
const PAD = { top: 25, right: 55, bottom: 55, left: 35 };

const CONTENT_LEFT = PAD.left;
const CONTENT_RIGHT = PAGE.width - PAD.right;
const CENTER_X = (CONTENT_LEFT + CONTENT_RIGHT) / 2;

const MAROON = rgb(0xae / 255, 0x0d / 255, 0x2e / 255);
const RED = rgb(1, 0, 0);
const BLACK = rgb(0, 0, 0);

/** .participant-line — the blank the name is written on. */
const NAME_LINE = { width: 565, borderWidth: 1.4 };

/**
 * CSS measures y downward from the top of the page; pdf-lib measures upward
 * from the bottom. Every constant here is written the CSS way and converted at
 * the point of use, so the numbers can be compared against the stylesheet
 * without doing arithmetic in your head.
 */
const fromTop = (y: number) => PAGE.height - y;

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont; title: PDFFont };

export async function generateCertificatePdf(
  participantName: string,
  options: { eventTitle?: string; dateText?: string } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE.width, PAGE.height]);

  const ctx: Ctx = {
    page,
    regular: await pdf.embedFont(StandardFonts.TimesRoman),
    bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    // Stands in for the blackletter face — see the FONTS note above.
    title: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: rgb(1, 1, 1),
  });

  // .right-strip is drawn before .bottom-strip because the stylesheet has it
  // first in the DOM — the bottom band paints over its last 30px.
  page.drawRectangle({
    x: PAGE.width - 30,
    y: 0,
    width: 30,
    height: PAGE.height - 185,
    color: MAROON,
  });

  page.drawRectangle({ x: 0, y: 0, width: PAGE.width * 0.22, height: 30, color: RED });
  page.drawRectangle({
    x: PAGE.width * 0.22,
    y: 0,
    width: PAGE.width * 0.78,
    height: 30,
    color: MAROON,
  });

  await drawLogos(pdf, page);

  // .certificate-title — 65px below the logo row, 59px, centred.
  const titleTop = PAD.top + 112 + 65;
  drawCentered(ctx, ctx.title, "Certificate of Participation", {
    size: 59,
    lineHeight: 59,
    top: titleTop,
    centerX: CENTER_X,
  });

  const bodyTop = titleTop + 59 + 72;
  drawBody(ctx, participantName, bodyTop, options);

  await drawSignatures(pdf, ctx);

  return pdf.save();
}

/**
 * .certificate-content — the four lines of prose, with the name written on the
 * blank in the first one.
 */
function drawBody(
  ctx: Ctx,
  participantName: string,
  top: number,
  options: { eventTitle?: string; dateText?: string },
) {
  const size = 25;
  const lineHeight = size * 1.35;

  // .first-line is a flex row on the baseline: lead-in, the blank, then the
  // tail. Measure all three so the group lands centred as a unit.
  const lead = "This is to certify that Mr./Ms.";
  const tail = "student of";
  const gap = 6;

  const leadWidth = ctx.regular.widthOfTextAtSize(lead, size);
  const tailWidth = ctx.regular.widthOfTextAtSize(tail, size);
  const rowWidth = leadWidth + gap + NAME_LINE.width + gap + tailWidth;
  const rowLeft = CENTER_X - rowWidth / 2;

  const baseline = baselineFor(ctx.regular, size, lineHeight, top);

  ctx.page.drawText(lead, { x: rowLeft, y: fromTop(baseline), size, font: ctx.regular });
  ctx.page.drawText(tail, {
    x: rowLeft + leadWidth + gap + NAME_LINE.width + gap,
    y: fromTop(baseline),
    size,
    font: ctx.regular,
  });

  // An inline-block's baseline is its bottom edge, so the rule under the name
  // sits exactly on the surrounding text's baseline — the name is written on
  // the line rather than floating above it.
  const lineLeft = rowLeft + leadWidth + gap;
  ctx.page.drawRectangle({
    x: lineLeft,
    y: fromTop(baseline) - NAME_LINE.borderWidth,
    width: NAME_LINE.width,
    height: NAME_LINE.borderWidth,
    color: BLACK,
  });

  drawNameOnLine(ctx, participantName, lineLeft, baseline, size);

  // The three paragraphs below. Adjacent <p> margins collapse to a single 3px,
  // which is why the step is `+ 3` and not `+ 6`.
  const eventTitle = options.eventTitle?.trim() || "AI Agent Workshop";

  let y = top + lineHeight + 3;
  y = drawParagraph(ctx, y, size, [
    { text: "K J Somaiya Institute Of Technology has successfully completed a hands on workshop on" },
  ]);

  y = drawParagraph(ctx, y + 3, size, [
    { text: `“${eventTitle}”`, bold: true },
    { text: " organized by " },
    { text: "Society for Data Science", bold: true },
  ]);

  y = drawParagraph(ctx, y + 3, 26, [{ text: "KJSIT Students Chapter.", bold: true }]);

  // .details — 72px below the prose. The template's 72px margin wins over the
  // paragraph's collapsed 3px rather than adding to it.
  const dateText = options.dateText?.trim() || "20th & 21st of August 2026";
  drawRuns(ctx, y + 72, 26, 26 * 1.15, [{ text: "Date: ", bold: true }, { text: dateText }]);
}

/**
 * Writes the name centred on its blank, shrinking it if it would otherwise run
 * past the end of the rule. A long name set smaller still reads as deliberate;
 * a long name spilling into "student of" reads as broken.
 */
function drawNameOnLine(
  ctx: Ctx,
  participantName: string,
  lineLeft: number,
  baseline: number,
  size: number,
) {
  const name = participantName.trim();
  if (!name) return;

  // Never below 60% — past that it stops matching the surrounding text at all,
  // and a name that long wants a second look rather than a smaller font.
  const maxWidth = NAME_LINE.width - 16;
  let fontSize = size;
  while (ctx.regular.widthOfTextAtSize(name, fontSize) > maxWidth && fontSize > size * 0.6) {
    fontSize -= 0.5;
  }

  const width = ctx.regular.widthOfTextAtSize(name, fontSize);

  ctx.page.drawText(name, {
    x: lineLeft + (NAME_LINE.width - width) / 2,
    // Lifted off the rule by a couple of points so the descenders in a name
    // like "Anjali" don't collide with it.
    y: fromTop(baseline) + 3,
    size: fontSize,
    font: ctx.regular,
    color: BLACK,
  });
}

/** One centred paragraph. Returns the y its box ends at, CSS-style. */
function drawParagraph(
  ctx: Ctx,
  top: number,
  size: number,
  runs: { text: string; bold?: boolean }[],
) {
  const lineHeight = size * 1.35;
  drawRuns(ctx, top, size, lineHeight, runs);
  return top + lineHeight;
}

/** A centred line built from mixed regular/bold runs, as the template does. */
function drawRuns(
  ctx: Ctx,
  top: number,
  size: number,
  lineHeight: number,
  runs: { text: string; bold?: boolean }[],
) {
  const widths = runs.map((run) =>
    (run.bold ? ctx.bold : ctx.regular).widthOfTextAtSize(run.text, size),
  );
  const total = widths.reduce((sum, width) => sum + width, 0);
  const baseline = baselineFor(ctx.regular, size, lineHeight, top);

  let x = CENTER_X - total / 2;
  runs.forEach((run, index) => {
    ctx.page.drawText(run.text, {
      x,
      y: fromTop(baseline),
      size,
      font: run.bold ? ctx.bold : ctx.regular,
      color: BLACK,
    });
    x += widths[index];
  });
}

function drawCentered(
  ctx: Ctx,
  font: PDFFont,
  text: string,
  box: { size: number; lineHeight: number; top: number; centerX: number },
) {
  if (!text) return;
  const width = font.widthOfTextAtSize(text, box.size);
  ctx.page.drawText(text, {
    x: box.centerX - width / 2,
    y: fromTop(baselineFor(font, box.size, box.lineHeight, box.top)),
    size: box.size,
    font,
    color: BLACK,
  });
}

/**
 * Where the baseline of a CSS line box falls, measured from the top of the
 * page. Half the leading sits above the glyphs, then the ascent — the same rule
 * a browser applies, so text lands where the stylesheet says it does.
 */
function baselineFor(font: PDFFont, size: number, lineHeight: number, top: number) {
  const ascent = font.heightAtSize(size, { descender: false });
  const halfLeading = (lineHeight - font.heightAtSize(size)) / 2;
  return top + halfLeading + ascent;
}

/** .top-section — Somaiya on the left, the two chapter marks on the right. */
async function drawLogos(pdf: PDFDocument, page: PDFPage) {
  await drawImage(pdf, page, "somaiya-logo.png", {
    x: CONTENT_LEFT,
    top: PAD.top,
    width: 350,
    height: 105,
    align: "left",
  });

  // .right-logo-group is right-aligned with an 18px gap between the two.
  await drawImage(pdf, page, "sds.png", {
    x: CONTENT_RIGHT - 112,
    top: PAD.top,
    width: 112,
    height: 112,
  });
  await drawImage(pdf, page, "s4ds-logo.png", {
    x: CONTENT_RIGHT - 112 - 18 - 112,
    top: PAD.top,
    width: 112,
    height: 112,
  });
}

const SIGNATORIES = [
  { file: "princi.png", name: "Dr. Vivek Sunnapwar", role: "Principal", height: 95 },
  { file: "nemade.png", name: "Dr. Milind U. Nemade", role: "Faculty Convener", height: 95 },
  // .sig-sejal and .sig-bathe are shorter — the source scans have different
  // internal padding, so the box is tuned per image to even out the ink.
  { file: "sejal.png", name: "Prof. Sejal Shah", role: "Faculty Coordinator", height: 92 },
  { file: "dbhate.png", name: "Prof. Devanand Bathe", role: "Faculty Coordinator", height: 88 },
];

/** .signatures — four boxes, space-between, pinned 47px off the bottom. */
async function drawSignatures(pdf: PDFDocument, ctx: Ctx) {
  const BOX = 220;
  const left = 50;
  const right = PAGE.width - 70;
  const gap = (right - left - SIGNATORIES.length * BOX) / (SIGNATORIES.length - 1);

  for (const [index, signatory] of SIGNATORIES.entries()) {
    const x = left + index * (BOX + gap);
    const centerX = x + BOX / 2;

    // The box is pinned by its bottom edge, so the stack is measured upward
    // from there — but every value stays in CSS's measure-from-the-top frame so
    // it can be read against the stylesheet.
    const boxBottom = PAGE.height - 47;

    const roleTop = boxBottom - 17 * 1.1;
    drawCentered(ctx, ctx.regular, signatory.role, {
      size: 17,
      lineHeight: 17 * 1.1,
      top: roleTop,
      centerX,
    });

    const nameTop = roleTop - 3 - 18 * 1.1;
    drawCentered(ctx, ctx.regular, signatory.name, {
      size: 18,
      lineHeight: 18 * 1.1,
      top: nameTop,
      centerX,
    });

    // .signature-line — a 2px rule with 5px of air under it.
    const ruleTop = nameTop - 5 - 2;
    ctx.page.drawRectangle({
      x,
      y: fromTop(ruleTop + 2),
      width: BOX,
      height: 2,
      color: BLACK,
    });

    await drawImage(pdf, ctx.page, signatory.file, {
      x: centerX - 100,
      top: ruleTop - 4 - signatory.height,
      width: 200,
      height: signatory.height,
    });
  }
}

/**
 * Draws an image the way CSS `object-fit: contain` would — scaled to fit inside
 * the box without distortion, rather than stretched to fill it.
 *
 * A missing file is logged and skipped instead of thrown: a certificate short
 * one signature is recoverable, a send that dies mid-queue is not.
 */
async function drawImage(
  pdf: PDFDocument,
  page: PDFPage,
  file: string,
  box: { x: number; top: number; width: number; height: number; align?: "left" | "center" },
) {
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(path.join(ASSETS, file));
  } catch (error) {
    console.error(`certificate asset missing: ${file}`, error);
    return;
  }

  const image = await pdf.embedPng(bytes);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  page.drawImage(image, {
    // object-position is `left top` for the Somaiya mark, centred for the rest.
    x: box.align === "left" ? box.x : box.x + (box.width - width) / 2,
    y: fromTop(box.top + (box.align === "left" ? height : (box.height + height) / 2)),
    width,
    height,
  });
}
