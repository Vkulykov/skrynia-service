const nodemailer = require("nodemailer");

let transportPromise = null;
let usingEthereal = false;

function getTransport() {
  if (!transportPromise) {
    if (process.env.SMTP_HOST) {
      transportPromise = Promise.resolve(
        nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined
        })
      );
    } else {
      usingEthereal = true;
      transportPromise = nodemailer.createTestAccount().then((account) =>
        nodemailer.createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: { user: account.user, pass: account.pass }
        })
      );
    }
  }
  return transportPromise;
}

async function sendExternal({ fromName, fromEmail, to, subject, text, attachments }) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text,
    attachments
  });
  return usingEthereal ? nodemailer.getTestMessageUrl(info) : null;
}

module.exports = { sendExternal };
