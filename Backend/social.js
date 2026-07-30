import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import Notification from '../models/Notification.js';
import Following from '../models/SocialGraph/Following.js';
import Followers from '../models/SocialGraph/Followers.js';
import Profile from '../models/Profile.js';
import Post from '../models/ContentsCreated/Post.js';
import Itinerary from '../models/ContentsCreated/Itinerary.js';
import ChatThread from '../models/Messages/ChatThread.js';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const streamUpload = (buffer, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
    if (result) resolve(result);
    else reject(err);
  });
  streamifier.createReadStream(buffer).pipe(stream);
});

const router = express.Router();

async function isFollowing(userId, targetId) {
  const rec = await Following.findOne({ user: userId });
  return rec?.followingIds.map(id => id.toString()).includes(targetId.toString()) ?? false;
}

router.get('/follow-status/:targetId', auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    const meId = req.user.id;
    const following = await isFollowing(meId, targetId);
    const theyFollowMe = await isFollowing(targetId, meId);
    const friends = following && theyFollowMe;
    const pending = await Notification.findOne({
      sender: meId, recipient: targetId, type: 'follow_request', status: 'pending',
    });
    res.json({ following, requested: !!pending, friends });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/follow/:targetId', auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    const meId = req.user.id;
    if (meId === targetId) return res.status(400).json({ msg: 'Cannot follow yourself' });
    if (await isFollowing(meId, targetId)) return res.status(400).json({ msg: 'Already following' });
    const existing = await Notification.findOne({
      sender: meId, recipient: targetId, type: 'follow_request', status: 'pending',
    });
    if (existing) return res.status(400).json({ msg: 'Request already sent' });
    await Notification.create({ recipient: targetId, sender: meId, type: 'follow_request' });
    res.json({ msg: 'Follow request sent' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/unfollow/:targetId', auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    const meId = req.user.id;
    await Following.updateOne({ user: meId }, { $pull: { followingIds: targetId } });
    await Followers.updateOne({ user: targetId }, { $pull: { followerIds: meId } });
    await Notification.deleteMany({ sender: meId, recipient: targetId, type: 'follow_request' });
    res.json({ msg: 'Unfollowed' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/notifications', auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'username nickname profileIconUrl')
      .populate('itinerary', 'title _id')
      .sort({ createdAt: -1 });

    const VerificationStatus = (await import('../models/VerificationStatus.js')).default;
    const senderIds = [...new Set(notifs.map(n => n.sender?._id?.toString()).filter(Boolean))];
    const verifications = await VerificationStatus.find({
      user: { $in: senderIds },
      status: 'verified',
    }).select('user');
    const verifiedSet = new Set(verifications.map(v => v.user.toString()));

    const enriched = notifs.map(n => ({
      ...n.toObject(),
      sender: n.sender ? {
        ...n.sender.toObject(),
        isVerified: verifiedSet.has(n.sender._id.toString()),
      } : null,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/notifications/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, status: { $nin: ['pending', 'read'] } },
      { $set: { status: 'read' } }
    );
    res.json({ msg: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/notifications/:id/accept', auth, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif || notif.recipient.toString() !== req.user.id)
      return res.status(404).json({ msg: 'Not found' });
    
    notif.status = 'accepted';
    await notif.save();

    if (notif.type === 'follow_request') {
      const followerId = notif.sender.toString();
      const followedId = req.user.id;
      await Following.findOneAndUpdate(
        { user: followerId },
        { $addToSet: { followingIds: followedId } },
        { upsert: true }
      );
      await Followers.findOneAndUpdate(
        { user: followedId },
        { $addToSet: { followerIds: followerId } },
        { upsert: true }
      );
      await Notification.create({
        recipient: followerId, sender: followedId, type: 'follow_accepted', status: 'read',
      });
    } else if (notif.type === 'trip_join_request') {
      const requesterId = notif.sender.toString();
      const itineraryId = notif.itinerary;
      
      const requesterProfile = await Profile.findById(requesterId);
      const itin = await Itinerary.findById(itineraryId);
      
      if (requesterProfile && itin) {
        await Itinerary.findByIdAndUpdate(itineraryId, {
          $addToSet: { members: requesterProfile.username }
        });

        let thread = await ChatThread.findOne({ itinerary: itineraryId, isGroup: true });
        if (!thread) {
          thread = await ChatThread.create({
            itinerary: itineraryId,
            isGroup: true,
            title: itin.title,
            participants: [itin.user, requesterId]
          });
        } else {
          await ChatThread.findByIdAndUpdate(thread._id, {
            $addToSet: { participants: requesterId }
          });
        }

        await Notification.create({
          recipient: requesterId,
          sender: req.user.id,
          itinerary: itineraryId,
          type: 'trip_join_accepted',
          status: 'pending'
        });
      }
    }

    res.json({ msg: 'Accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/notifications/:id/decline', auth, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif || notif.recipient.toString() !== req.user.id)
      return res.status(404).json({ msg: 'Not found' });
    notif.status = 'declined';
    await notif.save();

    if (notif.type === 'trip_join_request') {
      await Notification.create({
        recipient: notif.sender,
        sender: req.user.id,
        itinerary: notif.itinerary,
        type: 'trip_join_declined',
        status: 'pending'
      });
    }

    res.json({ msg: 'Declined' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/notifications/:id/read', auth, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { status: 'read' });
    res.json({ msg: 'Marked read' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/notifications/:id', auth, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif || notif.recipient.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Notification not found' });
    }
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/profile/posts', auth, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.user.id })
      .populate('user', 'username nickname profileIconUrl')
      .sort({ createdAt: -1 });
    const enriched = await Promise.all(posts.map(async p => {
      const Like = (await import('../models/ActivityLog/Like.js')).default;
      const Comment = (await import('../models/ActivityLog/Comment.js')).default;
      const Saved = (await import('../models/ActivityLog/Saved.js')).default;
      const [likes, comments, saves] = await Promise.all([
        Like.countDocuments({ post: p._id }),
        Comment.countDocuments({ post: p._id }),
        Saved.countDocuments({ post: p._id }),
      ]);
      return { ...p.toObject(), likeCount: likes, commentCount: comments, saveCount: saves };
    }));
    res.json(enriched);
  } catch (err) { res.status(500).json({ msg: 'Server error' }); }
});

router.get('/profile/liked', auth, async (req, res) => {
  try {
    const Like = (await import('../models/ActivityLog/Like.js')).default;
    const Comment = (await import('../models/ActivityLog/Comment.js')).default;
    const Saved = (await import('../models/ActivityLog/Saved.js')).default;
    const likes = await Like.find({ user: req.user.id }).select('post');
    const postIds = likes.map(l => l.post);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('user', 'username nickname profileIconUrl')
      .sort({ createdAt: -1 });
    const enriched = await Promise.all(posts.map(async p => {
      const [likeCount, commentCount, saveCount, myLike, mySave] = await Promise.all([
        Like.countDocuments({ post: p._id }),
        Comment.countDocuments({ post: p._id }),
        Saved.countDocuments({ post: p._id }),
        Like.findOne({ post: p._id, user: req.user.id }),
        Saved.findOne({ post: p._id, user: req.user.id }),
      ]);
      return { 
        ...p.toObject(), 
        likeCount, 
        commentCount, 
        saveCount,
        isLiked: !!myLike,
        isSaved: !!mySave
      };
    }));
    res.json(enriched);
  } catch (err) { res.status(500).json({ msg: 'Server error' }); }
});

router.get('/profile/saved', auth, async (req, res) => {
  try {
    const Saved = (await import('../models/ActivityLog/Saved.js')).default;
    const Like = (await import('../models/ActivityLog/Like.js')).default;
    const Comment = (await import('../models/ActivityLog/Comment.js')).default;
    const saves = await Saved.find({ user: req.user.id }).select('post');
    const postIds = saves.map(s => s.post);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('user', 'username nickname profileIconUrl')
      .sort({ createdAt: -1 });
    const enriched = await Promise.all(posts.map(async p => {
      const [likeCount, commentCount, saveCount, myLike, mySave] = await Promise.all([
        Like.countDocuments({ post: p._id }),
        Comment.countDocuments({ post: p._id }),
        Saved.countDocuments({ post: p._id }),
        Like.findOne({ post: p._id, user: req.user.id }),
        Saved.findOne({ post: p._id, user: req.user.id }),
      ]);
      return { 
        ...p.toObject(), 
        likeCount, 
        commentCount, 
        saveCount,
        isLiked: !!myLike,
        isSaved: !!mySave
      };
    }));
    res.json(enriched);
  } catch (err) { res.status(500).json({ msg: 'Server error' }); }
});

router.get('/profile/mutual-followers', auth, async (req, res) => {
  try {
    const meId = req.user.id;
    const myFollowing = await Following.findOne({ user: meId });
    const iFollow = myFollowing?.followingIds.map(id => id.toString()) || [];
    const theirFollowing = await Following.find({ followingIds: meId });
    const theyFollowMe = theirFollowing.map(r => r.user.toString());
    const mutualIds = iFollow.filter(id => theyFollowMe.includes(id));
    const users = await Profile.find({ _id: { $in: mutualIds } })
      .select('username nickname profileIconUrl');
    res.json(users);
  } catch (err) { res.status(500).json({ msg: 'Server error' }); }
});

router.get('/profile/me', auth, async (req, res) => {
  try {
    const meId = req.user.id;
    const profile = await Profile.findById(meId).select('-password');
    if (!profile) return res.status(404).json({ msg: 'Profile not found' });
    
    const VerificationStatus = (await import('../models/VerificationStatus.js')).default;
    
    const [followingRec, followersRec, postCount, tripCount, vs] = await Promise.all([
      Following.findOne({ user: meId }),
      Followers.findOne({ user: meId }),
      Post.countDocuments({ user: meId }),
      Itinerary.countDocuments({ user: meId }),
      VerificationStatus.findOne({ user: meId }),
    ]);
    
    res.json({
      _id: profile._id,
      username: profile.username,
      nickname: profile.nickname,
      email: profile.email,
      phoneNo: profile.phoneNo,
      bio: profile.bio,
      profileIconUrl: profile.profileIconUrl,
      coverImageUrl: profile.coverImageUrl,
      isVerified: vs?.status === 'verified',
      verificationStatus: vs?.status || 'none',
      travelPhilosophy: profile.travelPhilosophy,
      travelPreferences: profile.travelPreferences,
      budget: profile.budget,
      pace: profile.pace,
      accommodation: profile.accommodation,
      activities: profile.activities,
      socialStyle: profile.socialStyle,
      languages: profile.languages,
      trips: profile.trips,
      onboardingComplete: profile.onboardingComplete,
      privacySettings: profile.privacySettings,
      webSettings: profile.webSettings,
      linkedAccounts: profile.linkedAccounts,
      stats: {
        posts: postCount,
        trips: tripCount,
        followers: followersRec?.followerIds?.length || 0,
        following: followingRec?.followingIds?.length || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.put('/profile/me', auth, async (req, res) => {
  try {
    const { bio, travelPhilosophy, nickname, username, email, phoneNo, profileIconUrl, coverImageUrl, privacySettings, linkedAccounts, webSettings } = req.body;
    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (travelPhilosophy !== undefined) updates.travelPhilosophy = travelPhilosophy;
    if (nickname !== undefined) updates.nickname = nickname;
    if (username !== undefined && username.trim()) updates.username = username.trim();
    if (email !== undefined && email.trim()) updates.email = email.trim();
    if (phoneNo !== undefined) updates.phoneNo = phoneNo;
    if (profileIconUrl !== undefined) updates.profileIconUrl = profileIconUrl;
    if (coverImageUrl !== undefined) updates.coverImageUrl = coverImageUrl;
    if (linkedAccounts !== undefined) updates.linkedAccounts = linkedAccounts;


    if (privacySettings !== undefined) {
      Object.keys(privacySettings).forEach(key => {
        updates[`privacySettings.${key}`] = privacySettings[key];
      });
    }
    if (webSettings !== undefined) {
      Object.keys(webSettings).forEach(key => {
        updates[`webSettings.${key}`] = webSettings[key];
      });
    }

    const profile = await Profile.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select('-password');
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});


router.post('/upload-image', [auth, upload.single('image')], async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No file provided' });
    try {
      const folder = req.body.folder || 'profiles';
      const result = await streamUpload(req.file.buffer, folder);
      return res.json({ url: result.secure_url });
    } catch (cloudErr) {
      console.warn('Cloudinary upload failed, falling back to base64:', cloudErr.message);
      const b64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${b64}`;
      return res.json({ url: dataUrl });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Upload failed' });
  }
});

router.post('/profile/onboard', auth, async (req, res) => {
  try {
    const { nickname, travelPhilosophy, travelPreferences, budget, pace, accommodation, activities, socialStyle, languages, skipKYC } = req.body;
    const updates = { onboardingComplete: true };
    
    if (nickname !== undefined) updates.nickname = nickname;
    if (travelPhilosophy !== undefined) updates.travelPhilosophy = travelPhilosophy;
    if (travelPreferences !== undefined) updates.travelPreferences = travelPreferences;
    if (budget !== undefined) updates.budget = budget;
    if (pace !== undefined) updates.pace = pace;
    if (accommodation !== undefined) updates.accommodation = accommodation;
    if (activities !== undefined) updates.activities = activities;
    if (socialStyle !== undefined) updates.socialStyle = socialStyle;
    if (languages !== undefined) updates.languages = languages;
    
  
    const profile = await Profile.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true }
    ).select('-password');
    
    res.json({ 
      msg: 'Onboarding completed',
      profile: {
        nickname: profile.nickname,
        travelPhilosophy: profile.travelPhilosophy,
        travelPreferences: profile.travelPreferences,
        budget: profile.budget,
        pace: profile.pace,
        accommodation: profile.accommodation,
        activities: profile.activities,
        socialStyle: profile.socialStyle,
        languages: profile.languages,
        onboardingComplete: profile.onboardingComplete,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/profile/:userId/posts', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const meId = req.user.id;
    const query = userId === meId
      ? { user: userId }
      : { user: userId, isPublic: true };
    const posts = await Post.find(query).populate('user', 'username nickname profileIconUrl').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/profile/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const meId = req.user.id;
    const profile = await Profile.findById(userId).select('-password');
    if (!profile) return res.status(404).json({ msg: 'User not found' });

    const VerificationStatus = (await import('../models/VerificationStatus.js')).default;

    const [followingRec, followersRec, postCount, tripCount, vs] = await Promise.all([
      Following.findOne({ user: userId }),
      Followers.findOne({ user: userId }),
      Post.countDocuments({ user: userId }),
      Itinerary.countDocuments({ user: userId }),
      VerificationStatus.findOne({ user: userId }),
    ]);

    const iFollow = await Following.exists({ user: meId, followingIds: userId });
    const theyFollowMe = await Following.exists({ user: userId, followingIds: meId });
    const pending = await Notification.findOne({ sender: meId, recipient: userId, type: 'follow_request', status: 'pending' });

    res.json({
      _id: profile._id,
      username: profile.username,
      nickname: profile.nickname,
      bio: profile.bio,
      phoneNo: profile.phoneNo,
      profileIconUrl: profile.profileIconUrl,
      coverImageUrl: profile.coverImageUrl,
      isVerified: vs?.status === 'verified',
      verificationStatus: vs?.status || 'none',
      travelPhilosophy: profile.travelPhilosophy,
      travelPreferences: profile.travelPreferences,
      budget: profile.budget,
      pace: profile.pace,
      accommodation: profile.accommodation,
      activities: profile.activities,
      socialStyle: profile.socialStyle,
      languages: profile.languages,
      trips: profile.trips,
      onboardingComplete: profile.onboardingComplete,
      stats: {
        posts: postCount,
        trips: tripCount,
        followers: followersRec?.followerIds?.length || 0,
        following: followingRec?.followingIds?.length || 0,
      },
      followStatus: {
        following: !!iFollow,
        requested: !!pending,
        friends: !!iFollow && !!theyFollowMe,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
