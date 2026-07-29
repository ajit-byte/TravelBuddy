import express from 'express';
import jwt from 'jsonwebtoken';
import { sendEmailOTP, verifyEmailOTP } from '../services/mailer.js';
import { sendPhoneOTP, verifyPhoneOTP } from '../services/sms.js';

const router = express.Router();

router.post('/send-email', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ msg: 'Valid email is required' });
  }
  try {
    await sendEmailOTP(email);
    res.json({ msg: 'OTP sent' });
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ msg: err.message });
    console.error('sendEmailOTP error:', err);
    res.status(500).json({ msg: 'Failed to send OTP. Please try again.' });
  }
});

router.post('/verify-email', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ msg: 'Email and OTP are required' });

  const result = verifyEmailOTP(email, otp);
  if (!result.valid) {
    if (result.reason === 'expired') return res.status(410).json({ msg: 'OTP has expired. Please request a new one.' });
    return res.status(401).json({ msg: 'Incorrect OTP. Please try again.' });
  }

  const resetToken = jwt.sign(
    { identifier: email, purpose: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  res.json({ msg: 'Email verified', resetToken });
});

router.post('/send-phone', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+\d{1,4}\d{6,14}$/.test(phone)) {
    return res.status(400).json({ msg: 'Valid phone number with country code is required (e.g., +19876543210)' });
  }
  try {
    await sendPhoneOTP(phone);
    res.json({ msg: 'OTP sent' });
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ msg: err.message });
    console.error('sendPhoneOTP error:', err.message, err.code);
    res.status(500).json({ msg: err.message || 'Failed to send OTP. Please try again.' });
  }
});

router.post('/verify-phone', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ msg: 'Phone and OTP are required' });

  try {
    const result = await verifyPhoneOTP(phone, otp);
    if (!result.valid) {
      return res.status(401).json({ msg: 'Incorrect OTP. Please try again.' });
    }

    const resetToken = jwt.sign(
      { identifier: phone, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    res.json({ msg: 'Phone verified', resetToken });
  } catch (err) {
    console.error('verifyPhoneOTP error:', err);
    res.status(500).json({ msg: 'Failed to verify OTP. Please try again.' });
  }
});

export default router;
