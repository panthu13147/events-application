import { generateCertificatePdf } from "../src/lib/certificates/generate";
import fs from "fs/promises";
import path from "path";

async function main() {
  const pdfBytes = await generateCertificatePdf("Panth Shah");
  const outPath = path.join(process.cwd(), "certificate-panth.pdf");
  
  await fs.writeFile(outPath, pdfBytes);
  console.log("Certificate saved to:", outPath);
}

main().catch(console.error);
