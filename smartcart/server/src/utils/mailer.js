const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

/**
 * Sends the verification OTP. Returns true if a real email was sent,
 * false if SMTP is not configured (OTP is logged to the console instead).
 */
async function sendOtpEmail(to, name, otp) {
  const t = getTransporter();
  if (!t) {
    console.log(`[DEV] OTP for ${to}: ${otp}`);
    return false;
  }
  const ttl = process.env.OTP_TTL_MINUTES || 10;
  await t.sendMail({
    from: process.env.MAIL_FROM || 'SmartCart <no-reply@smartcart.local>',
    to,
    subject: 'Your SmartCart verification code',
    text: `Hi ${name},\n\nYour SmartCart verification code is ${otp}. It expires in ${ttl} minutes.\n\nIf you did not create an account, you can ignore this email.`,
  });
  return true;
}

module.exports = { sendOtpEmail };
