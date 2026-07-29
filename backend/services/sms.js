import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

export async function sendPhoneOTP(phone) {
  if (!checkRateLimit(`phone:${phone}`)) {
    throw Object.assign(new Error('Too many OTP requests. Try again in 1 hour.'), { status: 429 });
  }

  await client.verify.v2.services(VERIFY_SERVICE_SID).verifications.create({
    to: phone,
    channel: 'sms',
  });
}

export async function verifyPhoneOTP(phone, inputOtp) {
  const result = await client.verify.v2
    .services(VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: phone, code: inputOtp.trim() });

  if (result.status === 'approved') {
    return { valid: true };
  }
  return { valid: false, reason: 'mismatch' };
}
