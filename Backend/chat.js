import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import Message from '../models/Messages/Message.js';
import ChatThread from '../models/Messages/ChatThread.js';
import User from '../models/Profile.js';
import Following from '../models/SocialGraph/Following.js';
import Notification from '../models/Notification.js';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB
const router = express.Router();

const streamUpload = (buffer, folder, resourceType = 'auto') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => { if (result) resolve(result); else reject(err); }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

async function getOrCreateThread(userA, userB) {
  let thread = await ChatThread.findOne({
    participants: { $all: [userA, userB], $size: 2 },
  });
  if (!thread) {
    thread = await ChatThread.create({ participants: [userA, userB] });
  }
  return thread;
}

router.get('/users', auth, async (req, res) => {
  try {
    const meId = req.user.id;
    
    const myFollowing = await Following.findOne({ user: meId });
    const iFollow = myFollowing?.followingIds.map(id => id.toString()) || [];
    const theirFollowing = await Following.find({ followingIds: meId });
    const theyFollowMe = theirFollowing.map(r => r.user.toString());
    const friendIds = [...new Set([...iFollow, ...theyFollowMe])];
    
    const friends = await User.find({ _id: { $in: friendIds } }, 'username nickname email profileIconUrl')
      .sort({ username: 1 });
    
    const VerificationStatus = (await import('../models/VerificationStatus.js')).default;
    const onlineUsers = req.app.get('onlineUsers') || new Map();
    
    const enrichedFriends = await Promise.all(friends.map(async u => {
      const vs = await VerificationStatus.findOne({ user: u._id });
      return {
        ...u.toObject(),
        isVerified: vs?.status === 'verified',
        online: onlineUsers.has(u._id.toString()),
        chatType: 'direct'
      };
    }));

    const pendingRequests = await Notification.find({ sender: meId, type: 'follow_request', status: 'pending' });
    const pendingUserIds = pendingRequests.map(n => n.recipient.toString()).filter(id => !friendIds.includes(id));
    
    const pendingUsers = await User.find({ _id: { $in: pendingUserIds } }, 'username nickname email profileIconUrl')
      .sort({ username: 1 });
    
    const enrichedPending = await Promise.all(pendingUsers.map(async u => {
      const vs = await VerificationStatus.findOne({ user: u._id });
      return {
        ...u.toObject(),
        isVerified: vs?.status === 'verified',
        online: onlineUsers.has(u._id.toString()),
        chatType: 'direct',
        pendingFollow: true
      };
    }));

    const groups = await ChatThread.find({
      participants: meId,
      isGroup: true
    }).populate('itinerary', 'title tripPacts');

    const groupThreads = groups.map(g => ({
      _id: g._id,
      nickname: g.title,
      username: g.itinerary?.title || g.title,
      isGroup: true,
      itineraryId: g.itinerary?._id,
      tripPacts: g.itinerary?.tripPacts || [],
      chatType: 'group',
      participantsCount: g.participants.length
    }));

    res.json([...enrichedFriends, ...enrichedPending, ...groupThreads]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/thread/:threadId', auth, async (req, res) => {
  try {
    const thread = await ChatThread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ msg: 'Thread not found' });
    if (!thread.participants.map(p => p.toString()).includes(req.user.id)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    await Message.deleteMany({ threadId: thread._id });
    await thread.deleteOne();
    res.json({ msg: 'Chat deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/thread/:userId/read', auth, async (req, res) => {
  try {
    const meId = req.user.id;
    const thread = await getOrCreateThread(meId, req.params.userId);
    await Message.updateMany(
      {
        threadId: thread._id,
        sender: { $ne: meId },
        status: { $ne: 'read' },
      },
      {
        $set: { status: 'read' },
        $addToSet: { readBy: { user: meId } },
      }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/thread/:userId', auth, async (req, res) => {
  try {
    const thread = await getOrCreateThread(req.user.id, req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = 30;
    const messages = await Message.find({ threadId: thread._id })
      .populate('sender', 'username nickname profileIconUrl isVerified')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ threadId: thread._id, messages: messages.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/group/thread/:threadId', auth, async (req, res) => {
  try {
    const thread = await ChatThread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ msg: 'Thread not found' });
    if (!thread.participants.map(p => p.toString()).includes(req.user.id)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const messages = await Message.find({ threadId: thread._id })
      .populate('sender', 'username nickname profileIconUrl isVerified')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ threadId: thread._id, messages: messages.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/send', auth, async (req, res) => {
  try {
    const { toUserId, content, type = 'text', location, isGroup = false } = req.body;
    if (!toUserId) return res.status(400).json({ msg: 'Target ID required' });
    
    let thread;
    if (isGroup) {
      thread = await ChatThread.findById(toUserId);
    } else {
      thread = await getOrCreateThread(req.user.id, toUserId);
    }
    
    if (!thread) return res.status(404).json({ msg: 'Thread not found' });

    const msgData = { threadId: thread._id, sender: req.user.id, type };
    if (type === 'text') msgData.content = content.trim();
    if (type === 'location') msgData.location = location;

    const msg = await Message.create(msgData);
    await ChatThread.findByIdAndUpdate(thread._id, { lastMessage: msg._id });
    const populated = await msg.populate('sender', 'username nickname profileIconUrl isVerified');

    const io = req.app.get('io');
    if (isGroup) {
      io?.to(thread._id.toString()).emit('message:new', { threadId: thread._id, message: populated });
    } else {
      const theyFollowMe = await Following.exists({ user: toUserId, followingIds: req.user.id });
      const iFollowThem = await Following.exists({ user: req.user.id, followingIds: toUserId });
      if (theyFollowMe || iFollowThem) {
        io?.to(toUserId).emit('message:new', { threadId: thread._id, message: populated });
      }
    }

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/send-media', [auth, upload.single('file')], async (req, res) => {
  try {
    const { toUserId, fileType = 'image', isGroup = 'false' } = req.body;
    const isGroupBool = isGroup === 'true';
    if (!toUserId || !req.file) return res.status(400).json({ msg: 'Target ID and file required' });

     const resourceType = fileType === 'image' ? 'image' : 'video';

    let uploadResult;
    try {
      uploadResult = await streamUpload(req.file.buffer, 'chat_media', resourceType);
    } catch (uploadErr) {
      console.error('Cloudinary upload failed:', uploadErr.message);
      return res.status(500).json({ msg: 'Media upload failed. Please try again.' });
    }

    let thread;
    if (isGroupBool) {
      thread = await ChatThread.findById(toUserId);
    } else {
      thread = await getOrCreateThread(req.user.id, toUserId);
    }
    
    if (!thread) return res.status(404).json({ msg: 'Thread not found' });

    const msg = await Message.create({
      threadId: thread._id,
      sender: req.user.id,
      attachments: [{ url: uploadResult.secure_url, publicId: uploadResult.public_id, fileType }],
    });
    await ChatThread.findByIdAndUpdate(thread._id, { lastMessage: msg._id });
    const populated = await msg.populate('sender', 'username nickname profileIconUrl isVerified');

    const io = req.app.get('io');
    if (isGroupBool) {
      io?.to(thread._id.toString()).emit('message:new', { threadId: thread._id, message: populated });
    } else {
      const theyFollowMe = await Following.exists({ user: toUserId, followingIds: req.user.id });
      const iFollowThem = await Following.exists({ user: req.user.id, followingIds: toUserId });
      if (theyFollowMe || iFollowThem) {
        io?.to(toUserId).emit('message:new', { threadId: thread._id, message: populated });
      }
    }

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.patch('/message/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body; 
    const msg = await Message.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (status === 'read') {
      await Message.findByIdAndUpdate(req.params.id, {
        $addToSet: { readBy: { user: req.user.id } },
      });
    }
    res.json(msg);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { receiver, message } = req.body;
    if (!receiver || !message?.trim()) return res.status(400).json({ msg: 'receiver and message required' });
    const thread = await getOrCreateThread(req.user.id, receiver);
    const msg = await Message.create({ threadId: thread._id, sender: req.user.id, content: message.trim() });
    await ChatThread.findByIdAndUpdate(thread._id, { lastMessage: msg._id });
    const populated = await msg.populate('sender', 'username nickname profileIconUrl isVerified');
    const io = req.app.get('io');
    io?.to(receiver).emit('message:new', { threadId: thread._id, message: populated });
    res.json(populated);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/unread-count', auth, async (req, res) => {
  try {
    const meId = req.user.id;
    const myFollowing = await Following.findOne({ user: meId });
    const iFollow = myFollowing?.followingIds.map(id => id.toString()) || [];
    const theirFollowing = await Following.find({ followingIds: meId });
    const theyFollowMe = theirFollowing.map(r => r.user.toString());
    const friendIds = [...new Set([...iFollow, ...theyFollowMe])];

    const threads = await ChatThread.find({ participants: meId });
    const validThreadIds = threads.filter(t => {
      if (t.isGroup) return true;
      const otherUser = t.participants.find(p => p.toString() !== meId);
      return otherUser ? friendIds.includes(otherUser.toString()) : false;
    }).map(t => t._id);
    
    const unreadMessagesCount = await Message.countDocuments({
      threadId: { $in: validThreadIds },
      sender:   { $ne: meId },
      deleted:  { $ne: true },
      'readBy.user': { $ne: meId },
    });

    res.json({ count: unreadMessagesCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/message/:id', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ msg: 'Message not found' });

    const meId = req.user.id;
    const isSender = msg.sender.toString() === meId;

    if (isSender) {
      msg.deleted = true;
      msg.deletedAt = new Date();
      msg.content = '';
      msg.attachments = [];
      msg.location = undefined;
      await msg.save();

      const io = req.app.get('io');
      const thread = await ChatThread.findById(msg.threadId);
      if (thread) {
        const payload = { messageId: msg._id.toString(), threadId: msg.threadId.toString() };
        io?.to(msg.threadId.toString()).emit('message:deleted', payload);
        thread.participants.forEach(p => {
          io?.to(p.toString()).emit('message:deleted', payload);
        });
      }
    } else {
      await Message.findByIdAndUpdate(msg._id, {
        $addToSet: { deletedFor: meId },
      });
    }

    res.json({ ok: true, isSender });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
