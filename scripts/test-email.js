require("dotenv").config({ path: ".env" });
const nodemailer = require("nodemailer");

async function main() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!user || !pass) {
    console.error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const { generateCertificatePdf } = require("./test-generate.js");

  try {
    const pdfBytes = await generateCertificatePdf("Panth Shah");
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || user,
      to: "panthu13147@gmail.com",
      subject: "Test certificate email from Node",
      text: "Please find your attached certificate.",
      html: "<p>Please find your attached certificate.</p>",
      attachments: [
        {
          filename: "certificate-Panth_Shah.pdf",
          content: Buffer.from(pdfBytes),
        },
      ],
    });
    console.log("Email sent successfully with PDF:", info);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

main();
