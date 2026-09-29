/**
 * Rebuilds the certificate's image assets from the design originals.
 *
 * `certificate-templates/assets` holds the full-resolution artwork — that is
 * the source of truth and stays untouched. But sds.png alone is 1.2MB at
 * 1394x1128 and the certificate draws it at 112x112, and pdf-lib embeds PNGs
 * losslessly at whatever size you hand it. Embedding the originals produced a
 * 2.2MB certificate; every one of those goes out as an email attachment.
 *
 * So this writes downscaled copies into src/lib/certificates/assets, which is
 * what generate.ts actually reads. Everything is stored at 2x its drawn size so
 * it still holds up when printed or zoomed.
 *
 * Re-run after changing anything in certificate-templates/assets:
 *   npx tsx scripts/optimize-certificate-assets.ts
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE = path.join(process.cwd(), "certificate-templates/assets");
const OUT = path.join(process.cwd(), "src/lib/certificates/assets");

/** Drawn size in certificate.css, doubled. */
const TARGETS: Record<string, { width: number; height: number }> = {
  "somaiya-logo.png": { width: 700, height: 210 },
  "s4ds-logo.png": { width: 224, height: 224 },
  "sds.png": { width: 224, height: 224 },
  "princi.png": { width: 400, height: 190 },
  "nemade.png": { width: 400, height: 190 },
  "sejal.png": { width: 400, height: 190 },
  "dbhate.png": { width: 400, height: 190 },
};

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  for (const [file, size] of Object.entries(TARGETS)) {
    const from = path.join(SOURCE, file);
    const to = path.join(OUT, file);

    const before = (await fs.stat(from)).size;

    await sharp(from)
      // `inside` never crops and never upscales past the original, which is the
      // same thing object-fit: contain does in the template.
      .resize({ ...size, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true })
      .toFile(to);

    const after = (await fs.stat(to)).size;
    console.log(
      `${file.padEnd(20)} ${(before / 1024).toFixed(0).padStart(5)}kb -> ${(after / 1024)
        .toFixed(0)
        .padStart(4)}kb`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
