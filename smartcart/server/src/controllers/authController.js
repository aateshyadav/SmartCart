const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { generateOtp, hashOtp, safeEqual } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mailer');

const OTP_TTL_MS = (Number(process.env.OTP_TTL_MINUTES) || 10) * 60 * 1000;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Creates a fresh OTP on the user doc (caller saves), returns the plain OTP
function issueOtp(user) {
  const otp = generateOtp();
  user.otpHash = hashOtp(otp);
  user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  user.otpLastSent = new Date();
  return otp;
}

async function deliverOtp(user, otp) {
  const emailed = await sendOtpEmail(user.email, user.name, otp);
  // Dev convenience only: expose the OTP when no SMTP is configured
  const exposeDevOtp = !emailed && process.env.NODE_ENV !== 'production';
  return exposeDevOtp ? { devOtp: otp } : {};
}

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

  let user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');

  if (user && user.isVerified) throw new HttpError(409, 'An account with this email already exists');

  if (user) {
    // Unverified leftover registration: let them restart with new details
    user.name = name;
    user.password = password;
  } else {
    user = new User({ name, email, password }); // role is never taken from the client
  }

  const otp = issueOtp(user);
  await user.save();
  const extra = await deliverOtp(user, otp);

  res.status(201).json({
    message: 'Account created. Enter the OTP sent to your email to verify.',
    email: user.email,
    ...extra,
  });
});

// POST /api/auth/verify-otp
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw new HttpError(400, 'Email and OTP are required');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select(
    '+otpHash +otpExpires +otpAttempts'
  );
  if (!user || !user.otpHash) throw new HttpError(400, 'Invalid or expired OTP');
  if (user.isVerified) throw new HttpError(400, 'Account already verified');

  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new HttpError(429, 'Too many incorrect attempts. Request a new OTP.');
  }
  if (!user.otpExpires || user.otpExpires.getTime() < Date.now()) {
    throw new HttpError(400, 'OTP has expired. Request a new one.');
  }

  if (!safeEqual(user.otpHash, hashOtp(String(otp).trim()))) {
    user.otpAttempts += 1;
    await user.save();
    throw new HttpError(400, 'Incorrect OTP');
  }

  user.isVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  await user.save();

  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

// POST /api/auth/resend-otp
exports.resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new HttpError(400, 'Email is required');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+otpLastSent');
  // Same response either way, so the endpoint can't be used to probe which emails exist
  const generic = { message: 'If the account exists and is unverified, a new OTP has been sent.' };
  if (!user || user.isVerified) return res.json(generic);

  if (user.otpLastSent && Date.now() - user.otpLastSent.getTime() < RESEND_COOLDOWN_MS) {
    throw new HttpError(429, 'Please wait a few seconds before requesting another OTP');
  }

  const otp = issueOtp(user);
  await user.save();
  const extra = await deliverOtp(user, otp);
  res.json({ ...generic, ...extra });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.isVerified) {
    throw new HttpError(403, 'Email not verified. Please verify with the OTP first.', {
      needsVerification: true,
      email: user.email,
    });
  }

  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});
