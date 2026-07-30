import express from 'express';
import auth from '../middleware/auth.js';
import Profile from '../models/Profile.js';
import MatchNotification from '../models/MatchNotification.js';
import MatchCache from '../models/MatchCache.js';
import Following from '../models/SocialGraph/Following.js';
import Notification from '../models/Notification.js';
import { scoreCompatibility } from '../services/matchingService.js';
import { runGlobalMatching } from '../services/matchingScheduler.js';

const router = express.Router();

router.post('/test-scheduler', auth, async (req, res) => {
  try {
    const user = await Profile.findById(req.user.id).select('isAdmin');
    if (!user?.isAdmin) return res.status(403).json({ msg: 'Admin only' });

    console.log('[Test] Manually triggering global matching scheduler...');
    runGlobalMatching().catch(err => console.error('[Test] Scheduler error:', err));

    res.json({ msg: 'Scheduler triggered — check server logs for progress' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/summary', auth, async (req, res) => {
  try {
    const latest = await MatchNotification.findOne({
      userId: req.user.id,
      read: false,
    }).sort({ createdAt: -1 });

    if (!latest) return res.json({ hasMatch: false });

    res.json({
      hasMatch: true,
      matchCount: latest.matchCount,
      notificationId: latest._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const notification = await MatchNotification.findById(req.params.id)
      .populate('matches.userId', 'username nickname profileIconUrl bio travelPreferences');

    if (!notification) return res.status(404).json({ msg: 'Not found' });

    const VerificationStatus = (await import('../models/VerificationStatus.js')).default;
    const enrichedMatches = await Promise.all(
      notification.matches.map(async (match) => {
        const vs = await VerificationStatus.findOne({ user: match.userId?._id });
        return {
          ...match.toObject(),
          isVerified: vs?.status === 'verified',
        };
      })
    );

    await MatchNotification.findByIdAndUpdate(req.params.id, { read: true });

    res.json({ ...notification.toObject(), matches: enrichedMatches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/message', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const meId = req.user.id;

    const followingDoc = await Following.findOne({ user: meId });
    const alreadyFollowing = followingDoc?.followingIds?.map(id => id.toString()).includes(targetUserId);

    if (!alreadyFollowing) {
      const existingReq = await Notification.findOne({
        sender: meId,
        recipient: targetUserId,
        type: 'follow_request',
        status: 'pending',
      });

      if (!existingReq) {
        await Notification.create({
          recipient: targetUserId,
          sender: meId,
          type: 'follow_request',
        });
      }
    }

    res.json({
      success: true,
      followed: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/pass', auth, async (req, res) => {
  try {
    const { notificationId, targetUserId } = req.body;

    await MatchNotification.findByIdAndUpdate(notificationId, {
      $pull: { matches: { userId: targetUserId } },
      $inc: { matchCount: -1 },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/trigger', auth, async (req, res) => {
  try {
    const currentUser = await Profile.findById(req.user.id).select('-password');
    if (!currentUser) return res.status(404).json({ msg: 'User not found' });

    // Exclude users the current user is already following
    const followingDoc = await Following.findOne({ user: currentUser._id });
    const alreadyFollowingIds = followingDoc?.followingIds ?? [];

    const candidates = await Profile.find({
      _id: { $ne: currentUser._id, $nin: alreadyFollowingIds },
      isAdmin: { $ne: true },
      onboardingComplete: true,
    }).select('-password').limit(50);

    const scored = [];

    for (const candidate of candidates) {
      try {
        const cacheQuery = {
          $or: [
            { userA: currentUser._id, userB: candidate._id },
            { userA: candidate._id, userB: currentUser._id }
          ]
        };
        let cachedMatch = await MatchCache.findOne(cacheQuery);
        let result;

        if (cachedMatch) {
          result = {
            score: cachedMatch.score,
            verdict: cachedMatch.verdict,
            sharedSignals: cachedMatch.sharedSignals,
            destinationOverlap: cachedMatch.destinationOverlap,
            matchReason: cachedMatch.matchReason
          };
        } else {
          result = await scoreCompatibility(currentUser, candidate);

          await MatchCache.create({
            userA: currentUser._id,
            userB: candidate._id,
            score: result.score,
            verdict: result.verdict,
            sharedSignals: result.sharedSignals,
            destinationOverlap: result.destinationOverlap,
            matchReason: result.matchReason
          });
        }

        if (result.verdict === 'high' || result.score >= 60) {
          scored.push({ candidate, result });
        }
      } catch (err) {
        console.error(`Scoring error for ${candidate._id}:`, err.message);
      }
    }

    const topMatches = scored
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 2);

    if (topMatches.length > 0) {
      const matchNotif = await MatchNotification.create({
        userId: currentUser._id,
        matchCount: topMatches.length,
        matches: topMatches.map(m => ({
          userId: m.candidate._id,
          score: m.result.score,
          matchReason: m.result.matchReason,
          sharedSignals: m.result.sharedSignals,
          destinationOverlap: m.result.destinationOverlap,
        })),
        read: false,
      });

      return res.json({
        msg: `Found ${topMatches.length} match(es)`,
        notificationId: matchNotif._id,
        matches: topMatches.map(m => ({
          userId: m.candidate._id,
          username: m.candidate.username,
          nickname: m.candidate.nickname,
          score: m.result.score,
          matchReason: m.result.matchReason,
        })),
      });
    }

    res.json({ msg: 'No high matches found this time', matches: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/score/:userId', auth, async (req, res) => {
  try {
    const meId = req.user.id;
    const targetId = req.params.userId;
    if (meId === targetId) return res.json({ score: 100, sharedSignals: ['You'] });

    const cacheQuery = {
      $or: [
        { userA: meId, userB: targetId },
        { userA: targetId, userB: meId }
      ]
    };
    let cachedMatch = await MatchCache.findOne(cacheQuery);
    if (cachedMatch) {
      return res.json({
        score: cachedMatch.score,
        sharedSignals: cachedMatch.sharedSignals,
      });
    }

    const currentUser = await Profile.findById(meId).select('-password');
    const targetUser = await Profile.findById(targetId).select('-password');
    
    if (!currentUser || !targetUser) return res.json({ score: 0, sharedSignals: [] });

    const result = await scoreCompatibility(currentUser, targetUser);
    
    await MatchCache.create({
      userA: currentUser._id,
      userB: targetUser._id,
      score: result.score,
      verdict: result.verdict,
      sharedSignals: result.sharedSignals,
      destinationOverlap: result.destinationOverlap,
      matchReason: result.matchReason
    });

    res.json({
      score: result.score,
      sharedSignals: result.sharedSignals,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
