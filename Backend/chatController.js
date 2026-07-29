import Message from '../models/Messages/Message.js';
import ChatThread from '../models/Messages/ChatThread.js';
import User from '../models/Profile.js';
import Following from '../models/SocialGraph/Following.js';
import { streamUpload } from '../utils/cloudinaryUpload.js';

export async function getOrCreateThread(userA, userB) {
  let thread = await ChatThread.findOne({ participants: { $all: [userA, userB], $size: 2 } });
  if (!thread) thread = await ChatThread.create({ participants: [userA, userB] });
  return thread;
}

export async function getFriends(req, res) {
  try {
    const meId = req.user.id;
    const myFollowing = await Following.findOne({ user: meId });
    const iFollow = myFollowing?.followingIds.map(id => id.toString()) || [];
    const theirFollowing = await Following.find({ followingIds: meId });
    const theyFollowMe = theirFollowing.map(r => r.user.toString());
    const friendIds = iFollow.filter(id => theyFollowMe.includes(id));
    if (friendIds.length === 0) return res.json([]);
    const users = await User.find({ _id: { $in: friendIds } }, 'username nickname email profileIconUrl').sort({ username: 1 });
    const onlineUsers = req.app.get('onlineUsers') || new Map();
    res.json(users.map(u => ({ ...u.toObject(), online: onlineUsers.has(u._id.toString()) })));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

export async function getThread(req, res) {
  try {
    const thread = await getOrCreateThread(req.user.id, req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const messages = await Message.find({ threadId: thread._id })
      .populate('sender', 'username nickname profileIconUrl')
      .sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30);
    res.json({ threadId: thread._id, messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

export async function getLegacyMessages(req, res) {
  try {
    const thread = await getOrCreateThread(req.user.id, req.params.userId);
    const messages = await Message.find({ threadId: thread._id })
      .populate('sender', 'username nickname profileIconUrl')
      .sort({ createdAt: 1 }).limit(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

export async function searchMessages(req, res) {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json([]);
    const thread = await getOrCreateThread(req.user.id, req.params.userId);
    const messages = await Message.find({ threadId: thread._id, content: { $regex: q.trim(), $options: 'i' } })
      .populate('sender', 'username nickname').sort({ createdAt: -1 }).limit(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

export async function sendMessage(req, res) {
  try {
    const { toUserId, content } = req.body;
    if (!toUserId || !content?.trim()) return res.status(400).json({ msg: 'toUserId and content required' });
    const thread = await getOrCreateThread(req.user.id, toUserId);
    const msg = await Message.create({ threadId: thread._id, sender: req.user.id, content: content.trim() });
    await ChatThread.findByIdAndUpdate(thread._id, { lastMessage: msg._id });
    const populated = await msg.populate('sender', 'username nickname profileIconUrl');
    req.app.get('io')?.to(toUserId).emit('message:new', { threadId: thread._id, message: populated });
    res.json(populated);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

export async function sendMedia(req, res) {
  try {
    const { toUserId, fileType = 'image' } = req.body;
    if (!toUserId || !req.file) return res.status(400).json({ msg: 'toUserId and file required' });
    let uploadResult;
    try {
      uploadResult = await streamUpload(req, 'chat_media', fileType === 'audio' ? 'video' : fileType);
    } catch {
      const b64 = req.file.buffer.toString('base64');
      uploadResult = { secure_url: `data:${req.file.mimetype};base64,${b64}`, public_id: '' };
    }
    const thread = await getOrCreateThread(req.user.id, toUserId);
    const msg = await Message.create({ threadId: thread._id, sender: req.user.id, attachments: [{ url: uploadResult.secure_url, publicId: uploadResult.public_id, fileType }] });
    await ChatThread.findByIdAndUpdate(thread._id, { lastMessage: msg._id });
    const populated = await msg.populate('sender', 'username nickname profileIconUrl');
    req.app.get('io')?.to(toUserId).emit('message:new', { threadId: thread._id, message: populated });
    res.json(populated);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

export async function updateMessageStatus(req, res) {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'read') {
      update.$addToSet = { readBy: { user: req.user.id } };
    }
    const msg = await Message.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

export async function legacySend(req, res) {
  try {
    const { receiver, message } = req.body;
    if (!receiver || !message?.trim()) return res.status(400).json({ msg: 'receiver and message required' });
    const thread = await getOrCreateThread(req.user.id, receiver);
    const msg = await Message.create({ threadId: thread._id, sender: req.user.id, content: message.trim() });
    await ChatThread.findByIdAndUpdate(thread._id, { lastMessage: msg._id });
    const populated = await msg.populate('sender', 'username nickname profileIconUrl');
    req.app.get('io')?.to(receiver).emit('message:new', { threadId: thread._id, message: populated });
    res.json(populated);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}
