import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import auth from '../middleware/auth.js';
import VerificationStatus from '../models/VerificationStatus.js';
import Notification from '../models/Notification.js';
import Profile from '../models/Profile.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ msg: 'Admin access required' });
  next();
}

const streamUpload = (buffer, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
    if (result) resolve(result); else reject(err);
  });
  streamifier.createReadStream(buffer).pipe(stream);
});

router.get('/status', auth, async (req, res) => {
  try {
    const vs = await VerificationStatus.findOne({ user: req.user.id });
    if (!vs) return res.json({ status: 'none' });
    res.json(vs);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/submit', [auth, upload.fields([{ name: 'frontImage', maxCount: 1 }, { name: 'backImage', maxCount: 1 }])], async (req, res) => {
  try {
    const { fullName, dateOfBirth, temporaryAddress, permanentAddress, country, documentType } = req.body;
    
    if (!fullName || !dateOfBirth || !temporaryAddress || !permanentAddress || !country || !documentType) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    if (!req.files || !req.files.frontImage || !req.files.backImage) {
      return res.status(400).json({ msg: 'Both front and back images are required' });
    }

    let frontImageUrl = '';
    let backImageUrl = '';

    try {
      const frontResult = await streamUpload(req.files.frontImage[0].buffer, 'verification_documents');
      frontImageUrl = frontResult.secure_url;
      const backResult = await streamUpload(req.files.backImage[0].buffer, 'verification_documents');
      backImageUrl = backResult.secure_url;
    } catch {
      const frontB64 = req.files.frontImage[0].buffer.toString('base64');
      frontImageUrl = `data:${req.files.frontImage[0].mimetype};base64,${frontB64}`;
      const backB64 = req.files.backImage[0].buffer.toString('base64');
      backImageUrl = `data:${req.files.backImage[0].mimetype};base64,${backB64}`;
    }

    await VerificationStatus.findOneAndUpdate(
      { user: req.user.id },
      {
        status: 'pending',
        fullName,
        dateOfBirth,
        temporaryAddress,
        permanentAddress,
        country,
        documentType,
        frontImageUrl,
        backImageUrl,
        submittedAt: new Date(),
        rejectionReason: '',
      },
      { upsert: true, new: true }
    );

    const admins = await Profile.find({ isAdmin: true });
    const notifications = admins.map(admin => ({
      recipient: admin._id,
      sender: req.user.id,
      type: 'verification_request',
      message: `${fullName} submitted a verification request.`,
      status: 'pending'
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.json({ msg: 'Verification request submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/requests', [auth, adminOnly], async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const requests = await VerificationStatus.find({ status })
      .populate('user', 'username nickname email profileIconUrl createdAt')
      .sort({ submittedAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/request/:userId', [auth, adminOnly], async (req, res) => {
    try {
        const request = await VerificationStatus.findOne({ user: req.params.userId }).populate('user', 'username nickname email profileIconUrl');
        if (!request) return res.status(404).json({ msg: 'Request not found' });
        res.json(request);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/:userId/approve', [auth, adminOnly], async (req, res) => {
  try {
    const vs = await VerificationStatus.findOneAndUpdate(
      { user: req.params.userId },
      {
        status: 'verified',
        reviewedAt: new Date(),
        rejectionReason: '',
      },
      { new: true }
    );

    if (!vs) return res.status(404).json({ msg: 'Verification request not found' });

    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.id, // Admin
      type: 'verification_approved',
      message: 'Congratulations! Your verification request has been approved. You are now a verified user.',
      status: 'pending'
    });

    res.json({ msg: 'Verification approved' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/:userId/reject', [auth, adminOnly], async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ msg: 'Rejection reason is required' });

    const vs = await VerificationStatus.findOneAndUpdate(
      { user: req.params.userId },
      {
        status: 'unverified',
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      { new: true }
    );

    if (!vs) return res.status(404).json({ msg: 'Verification request not found' });

    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.id, // Admin
      type: 'verification_rejected',
      message: `Your verification request was not approved. Reason: ${reason}`,
      status: 'pending'
    });

    res.json({ msg: 'Verification rejected' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/stats', [auth, adminOnly], async (req, res) => {
  try {
    const [total, pending, verified, unverified] = await Promise.all([
      Profile.countDocuments({ isAdmin: { $ne: true } }),
      VerificationStatus.countDocuments({ status: 'pending' }),
      VerificationStatus.countDocuments({ status: 'verified' }),
      VerificationStatus.countDocuments({ status: 'unverified' }),
    ]);
    res.json({ totalUsers: total, pendingKyc: pending, approvedKyc: verified, rejectedKyc: unverified });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
