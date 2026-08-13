import express from 'express';
import auth from '../middleware/auth.js';
import Itinerary from '../models/ContentsCreated/Itinerary.js';
import SavedItinerary from '../models/ActivityLog/SavedItinerary.js';
import Notification from '../models/Notification.js';
import Profile from '../models/Profile.js';
import multer from 'multer';
import { streamUpload } from '../utils/cloudinaryUpload.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

// Create new itinerary
router.post('/', auth, async (req, res) => {
  try {
    const {
      title, destinations, startDate, endDate, activities,
      budget = 0, notes = '', isPublic = false,
      activityItems = [], tripPacts = [], members = [], tags = [], image = '', status = 'Draft'
    } = req.body;

    const newItinerary = new Itinerary({
      user: req.user.id,
      title,
      destinations: Array.isArray(destinations) ? destinations.filter(d => d.trim()) : (destinations ? [destinations] : []),
      startDate,
      endDate,
      activities: Array.isArray(activities) ? activities : (activities ? activities.split(',').map(a => a.trim()) : []),
      budget: Number(budget),
      notes,
      isPublic: !!isPublic,
      activityItems: Array.isArray(activityItems) ? activityItems.map(a => ({
        dayId: Number(a.dayId) || 1,
        date: a.date || '',
        name: a.name || '',
        description: a.description || '',
        note: a.note || '',
        time: a.time || '',
        cost: Number(a.cost) || 0,
        location: a.location || '',
        budgetType: a.budgetType || 'Food',
        suggestedBy: a.suggestedBy || '',
      })) : [],
      tripPacts: Array.isArray(tripPacts) ? tripPacts : [],
      members: Array.isArray(members) ? members : [],
      tags: Array.isArray(tags) ? tags : [],
      image,
      status: status
    });

    await newItinerary.save();
    res.status(201).json(newItinerary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json([]);
    
    const query = q.trim();
    const itineraries = await Itinerary.find({
      isPublic: true,
      endDate: { $gte: new Date() },  // hide expired trips
      $or: [
        { destinations: { $regex: query, $options: 'i' } },
        { activities: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } },
      ],
    })
    .populate('user', 'username nickname profileIconUrl isVerified')
    .sort({ createdAt: -1 })
    .limit(20);

    const enriched = await Promise.all(itineraries.map(async it => {
      const saveCount = await SavedItinerary.countDocuments({ itinerary: it._id });
      return { ...it.toObject(), saveCount };
    }));
    
    res.json(enriched);
  } catch (err) {
    console.error('Error searching itineraries:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/public', auth, async (req, res) => {
  try {
    const itineraries = await Itinerary.find({
      isPublic: true,
      endDate: { $gte: new Date() },  // hide expired trips
    })
      .populate('user', 'username nickname profileIconUrl isVerified')
      .sort({ createdAt: -1 });
    // Enrich with save count
    const enriched = await Promise.all(itineraries.map(async it => {
      const saveCount = await SavedItinerary.countDocuments({ itinerary: it._id });
      return { ...it.toObject(), saveCount };
    }));
    res.json(enriched);
  } catch (err) {
    console.error('Error fetching public itineraries:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const itineraries = await Itinerary.find({ user: req.user.id })
      .populate('user', 'username nickname profileIconUrl')
      .sort({ createdAt: -1 });

    const enriched = await Promise.all(itineraries.map(async (it) => {
      const memberProfiles = it.members?.length
        ? await Profile.find({ username: { $in: it.members } }).select('username nickname profileIconUrl')
        : [];
      return {
        ...it.toObject(),
        memberProfiles: memberProfiles.map(p => ({
          username: p.username,
          nickname: p.nickname,
          profileIconUrl: p.profileIconUrl || null,
        })),
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/joined', auth, async (req, res) => {
  try {
    const currentUser = await Profile.findById(req.user.id).select('username');
    if (!currentUser) return res.status(404).json({ msg: 'User not found' });

    const itineraries = await Itinerary.find({
      members: currentUser.username,
      user: { $ne: req.user.id }, // exclude own itineraries
    })
      .populate('user', 'username nickname profileIconUrl')
      .sort({ startDate: -1 });

    const enriched = await Promise.all(itineraries.map(async (it) => {
      const memberProfiles = it.members?.length
        ? await Profile.find({ username: { $in: it.members } }).select('username nickname profileIconUrl')
        : [];
      return {
        ...it.toObject(),
        isJoined: true, 
        memberProfiles: memberProfiles.map(p => ({
          username: p.username,
          nickname: p.nickname,
          profileIconUrl: p.profileIconUrl || null,
        })),
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/saved/list', auth, async (req, res) => {
  try {
    const saves = await SavedItinerary.find({ user: req.user.id }).select('itinerary');
    const itineraries = await Itinerary.find({ _id: { $in: saves.map(s => s.itinerary) } })
      .populate('user', 'username nickname profileIconUrl isVerified')
      .sort({ createdAt: -1 });
    res.json(itineraries);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id).populate('user', 'username nickname profileIconUrl isVerified');
    if (!itinerary) return res.status(404).json({ msg: 'Itinerary not found' });
    
    const isOwner = itinerary.user._id.toString() === req.user.id;
    const currentUser = await Profile.findById(req.user.id);
    const isMember = itinerary.members && itinerary.members.includes(currentUser.username);
    
    if (!itinerary.isPublic && !isOwner && !isMember) {
      return res.status(403).json({ msg: 'Not authorized to view this private itinerary' });
    }
    
    res.json(itinerary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) return res.status(404).json({ msg: 'Itinerary not found' });
    if (itinerary.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const {
      title, destinations, startDate, endDate, activities,
      budget, notes, isPublic, activityItems, tripPacts, members, tags, image, status
    } = req.body;

    if (title) itinerary.title = title;
    if (destinations) itinerary.destinations = Array.isArray(destinations) ? destinations.filter(d => d.trim()) : [destinations];
    if (startDate) itinerary.startDate = startDate;
    if (endDate) itinerary.endDate = endDate;
    if (activities !== undefined) {
      itinerary.activities = Array.isArray(activities) ? activities : (activities ? activities.split(',').map(a => a.trim()) : []);
    }
    if (budget !== undefined) itinerary.budget = Number(budget);
    if (notes !== undefined) itinerary.notes = notes;
    if (isPublic !== undefined) itinerary.isPublic = !!isPublic;

    if (status !== undefined) itinerary.status = status;
    if (Array.isArray(tripPacts)) itinerary.tripPacts = tripPacts;
    if (Array.isArray(members)) itinerary.members = members;
    if (Array.isArray(tags)) itinerary.tags = tags;
    if (image !== undefined) itinerary.image = image;

    if (Array.isArray(activityItems)) {
      itinerary.activityItems = activityItems.map(a => ({
        dayId: Number(a.dayId) || 1,
        date: a.date || '',
        name: a.name || '',
        description: a.description || '',
        note: a.note || '',
        time: a.time || '',
        cost: Number(a.cost) || 0,
        location: a.location || '',
        budgetType: a.budgetType || 'Food',
        suggestedBy: a.suggestedBy || '',
      }));
    }

    await itinerary.save();
    res.json(itinerary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/:id/upload-image', [auth, upload.single('image')], async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) return res.status(404).json({ msg: 'Itinerary not found' });
    if (itinerary.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: 'No image uploaded' });
    }

    const result = await streamUpload(req, 'itineraries');
    itinerary.image = result.secure_url;
    await itinerary.save();

    res.json(itinerary);
  } catch (err) {
    console.error('Error uploading itinerary image:', err);
    res.status(500).json({ msg: 'Server error during upload' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) return res.status(404).json({ msg: 'Itinerary not found' });
    if (itinerary.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (itinerary.members && itinerary.members.length > 0) {
      const memberProfiles = await Profile.find({ username: { $in: itinerary.members } });
      const notifications = memberProfiles.map(profile => ({
        recipient: profile._id,
        sender: req.user.id,
        type: 'trip_update',
        message: `The trip "${itinerary.title}" was deleted by its planner.`,
        status: 'pending'
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    await itinerary.deleteOne();
    res.json({ msg: 'Itinerary deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/:id/save', auth, async (req, res) => {
  try {
    const existing = await SavedItinerary.findOne({ user: req.user.id, itinerary: req.params.id });
    if (existing) {
      await existing.deleteOne();
      return res.json({ saved: false });
    }
    await SavedItinerary.create({ user: req.user.id, itinerary: req.params.id });
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/:id/save', auth, async (req, res) => {
  try {
    const saved = !!(await SavedItinerary.findOne({ user: req.user.id, itinerary: req.params.id }));
    res.json({ saved });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/:id/member-profiles', auth, async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id).select('members');
    if (!itinerary) return res.status(404).json({ msg: 'Not found' });
    if (!itinerary.members?.length) return res.json([]);
    const profiles = await Profile.find({ username: { $in: itinerary.members } })
      .select('username nickname profileIconUrl');
    res.json(profiles.map(p => ({
      username: p.username,
      nickname: p.nickname,
      profileIconUrl: p.profileIconUrl || null,
    })));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/:id/join-requests/count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      itinerary: req.params.id,
      type: 'trip_join_request',
      status: 'pending'
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/:id/join-request', auth, async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) return res.status(404).json({ msg: 'Itinerary not found' });
    if (itinerary.user.toString() === req.user.id) {
      return res.status(400).json({ msg: 'You are the owner' });
    }

    const existing = await Notification.findOne({
      sender: req.user.id,
      itinerary: req.params.id,
      type: 'trip_join_request',
      status: 'pending'
    });
    if (existing) return res.status(400).json({ msg: 'Request already pending' });

    await Notification.create({
      recipient: itinerary.user,
      sender: req.user.id,
      itinerary: req.params.id,
      type: 'trip_join_request'
    });
    res.json({ msg: 'Join request sent' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/:id/join-request-status', auth, async (req, res) => {
  try {
    const existing = await Notification.findOne({
      sender: req.user.id,
      itinerary: req.params.id,
      type: 'trip_join_request',
      status: { $in: ['pending', 'accepted'] }
    });
    res.json({ requested: !!existing });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/:id/leave', auth, async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) return res.status(404).json({ msg: 'Itinerary not found' });
    
    const currentUser = await Profile.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ msg: 'User profile not found' });

    if (!itinerary.members.includes(currentUser.username)) {
      return res.status(400).json({ msg: 'Not a member of this itinerary' });
    }
    
    itinerary.members = itinerary.members.filter(m => m !== currentUser.username);
    await itinerary.save();
    
    res.json({ msg: 'Left the itinerary successfully', username: currentUser.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;