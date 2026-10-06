const crypto = require('crypto');

// 6-digit numeric OTP from a CSPRNG
function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// OTPs are short-lived, so a keyed SHA-256 is enough; the secret acts as a pepper.
function hashOtp(otp) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'dev-secret')
    .update(String(otp))
    .digest('hex');
}

function safeEqual(a, b) {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

module.exports = { generateOtp, hashOtp, safeEqual };
