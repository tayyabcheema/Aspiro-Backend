const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail({ to, subject, html, text }) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html: html || (text && `<pre>${text}</pre>`),
    text
  };
  return transporter.sendMail(mailOptions);
}

module.exports = sendEmail;
