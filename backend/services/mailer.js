import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const otpStore = new Map();
const rateLimitStore = new Map();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

export async function sendEmailOTP(email) {
  if (!checkRateLimit(`email:${email}`)) {
    throw Object.assign(new Error('Too many OTP requests. Try again in 1 hour.'), { status: 429 });
  }

  const otp = generateOTP();
  otpStore.set(`email:${email}`, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS });

  await transporter.sendMail({
    from: `"TravelBuddy" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your TravelBuddy Verification Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:16px;">
        <h2 style="color:#1a237e;margin-bottom:8px;">Verify your email</h2>
        <p style="color:#555;margin-bottom:24px;">Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#fff;border:2px solid #e8eaf6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#1a237e;">${otp}</span>
        </div>
        <p style="color:#999;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export function verifyEmailOTP(email, inputOtp) {
  const record = otpStore.get(`email:${email}`);
  if (!record) return { valid: false, reason: 'expired' };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(`email:${email}`);
    return { valid: false, reason: 'expired' };
  }
  if (record.otp !== inputOtp.trim()) return { valid: false, reason: 'mismatch' };
  otpStore.delete(`email:${email}`);
  return { valid: true };
}
