import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from '../config/passport.js';
import User from '../models/Profile.js';

const router = express.Router();

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'Admin10@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin12345';

async function ensureAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (!existing) {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, salt);
    await User.create({ username: 'Admin', email: ADMIN_EMAIL, password: hashed, isAdmin: true });
  } else if (!existing.isAdmin) {
    await User.findByIdAndUpdate(existing._id, { isAdmin: true });
  }
}
ensureAdmin().catch(console.error);

router.post('/signup', async (req, res) => {
  const { username, email, password, phoneNo } = req.body;
  try {
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase())
      return res.status(400).json({ msg: 'This email is reserved' });

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({ username, email, password, phoneNo });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = { user: { id: user.id, isAdmin: false } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ msg: 'Invalid email address' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User does not exist with this email' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ msg: 'Incorrect password' });

    const payload = { user: { id: user.id, isAdmin: !!user.isAdmin } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
router.post('/reset-password', async (req, res) => {
  const { identifier, newPassword, resetToken } = req.body;
  try {
    if (!identifier || !newPassword || !resetToken) {
      return res.status(400).json({ msg: 'Identifier, new password, and reset token are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ msg: 'Invalid or expired reset token. Please verify your OTP again.' });
    }

    if (decoded.purpose !== 'password_reset' || decoded.identifier !== identifier) {
      return res.status(401).json({ msg: 'Reset token does not match the provided identifier.' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNo: identifier }]
    });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

const LINK_LIMITS = { Gmail: 5, GitHub: 1, LinkedIn: 1, Discord: 1 };

function canLink(profile, platform) {
  const limit = LINK_LIMITS[platform] ?? 1;
  const current = (profile.linkedAccounts || []).filter(a => a.platform === platform).length;
  return current < limit;
}

router.get('/google', (req, res, next) => {
  const mode  = req.query.mode  || 'login';
  const token = req.query.token || ''; 
  const state = JSON.stringify({ mode, token });
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
  })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`,
  }),
  async (req, res) => {
    let mode  = 'login';
    let callerToken = '';

    try {
      const parsed = JSON.parse(req.query.state || '{}');
      mode        = parsed.mode  || 'login';
      callerToken = parsed.token || '';
    } catch { /* state was plain string from old flow */ mode = req.query.state || 'login'; }

    const googleEmail = req.user.email;
    const name        = req.user.nickname || req.user.username || '';
    const photo       = req.user.profileIconUrl || '';

    if (mode === 'link') {
      try {
        const jwt_mod = await import('jsonwebtoken');
        const decoded = jwt_mod.default.verify(callerToken, process.env.JWT_SECRET);
        const userId  = decoded.user.id;

        const profile = await User.findById(userId);
        if (!profile) {
          return res.redirect(`${process.env.FRONTEND_URL}/profile?error=user_not_found`);
        }

        const alreadyLinked = profile.linkedAccounts?.some(
          a => a.platform === 'Gmail' && a.handle === googleEmail
        );

        if (!alreadyLinked && canLink(profile, 'Gmail')) {
          profile.linkedAccounts = profile.linkedAccounts || [];
          profile.linkedAccounts.push({
            platform: 'Gmail',
            handle: googleEmail,
            url: `mailto:${googleEmail}`,
            verifiedViaOAuth: true,
            connectedAt: new Date(),
          });
          await profile.save();
        } else if (!canLink(profile, 'Gmail')) {
          return res.redirect(`${process.env.FRONTEND_URL}/profile?error=gmail_limit`);
        }

        return res.redirect(`${process.env.FRONTEND_URL}/profile?linked=gmail&email=${encodeURIComponent(googleEmail)}`);
      } catch (err) {
        console.error('Link mode error:', err);
        return res.redirect(`${process.env.FRONTEND_URL}/profile?error=link_failed`);
      }
    }

    if (mode === 'verify') {
      const isNewAccount = (Date.now() - new Date(req.user.createdAt).getTime()) < 10000;

      if (!isNewAccount) {
        const payload = { user: { id: req.user.id, isAdmin: !!req.user.isAdmin } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.redirect(`${process.env.FRONTEND_URL}/auth/google/success?token=${token}&hint=existing`);
      }

      const params = new URLSearchParams({ verified_email: googleEmail, name, photo });
      return res.redirect(`${process.env.FRONTEND_URL}/signup?${params}`);
    }

    const isNewAccount = (Date.now() - new Date(req.user.createdAt).getTime()) < 10000;

    if (isNewAccount) {
      const params = new URLSearchParams({ verified_email: googleEmail, name, photo, from_login: '1' });
      return res.redirect(`${process.env.FRONTEND_URL}/signup?${params}`);
    }

    const payload = { user: { id: req.user.id, isAdmin: !!req.user.isAdmin } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${process.env.FRONTEND_URL}/auth/google/success?token=${token}`);
  }
);


router.get('/github', (req, res, next) => {
  const token = req.query.token || '';
  const state = JSON.stringify({ token });
  passport.authenticate('github', {
    scope: ['read:user'],
    session: false,
    state,
  })(req, res, next);
});

router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/profile?error=github_failed`,
  }),
  async (req, res) => {
    let callerToken = '';
    try {
      const parsed = JSON.parse(req.query.state || '{}');
      callerToken  = parsed.token || '';
    } catch { /* ignore */ }

    const { githubUsername, profileUrl } = req.user;

    try {
      const jwt_mod = await import('jsonwebtoken');
      const decoded = jwt_mod.default.verify(callerToken, process.env.JWT_SECRET);
      const userId  = decoded.user.id;

      const profile = await User.findById(userId);
      if (!profile) return res.redirect(`${process.env.FRONTEND_URL}/profile?error=user_not_found`);

      if (!canLink(profile, 'GitHub')) {
        return res.redirect(`${process.env.FRONTEND_URL}/profile?error=github_limit`);
      }

      const alreadyLinked = profile.linkedAccounts?.some(
        a => a.platform === 'GitHub' && a.handle === `@${githubUsername}`
      );

      if (!alreadyLinked) {
        profile.linkedAccounts = profile.linkedAccounts || [];
        profile.linkedAccounts.push({
          platform: 'GitHub',
          handle: `@${githubUsername}`,
          url: profileUrl,
          verifiedViaOAuth: true,
          connectedAt: new Date(),
        });
        await profile.save();
      }

      return res.redirect(
        `${process.env.FRONTEND_URL}/profile?linked=github&handle=${encodeURIComponent('@' + githubUsername)}`
      );
    } catch (err) {
      console.error('GitHub link error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/profile?error=github_link_failed`);
    }
  }
);


router.get('/linkedin', (req, res, next) => {
  const userToken = req.query.token || '';
   res.cookie('linkedin_link_token', userToken, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000, // 5 minutes
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  passport.authenticate('linkedin', {
    scope: ['openid', 'profile', 'email'],
    session: false,
  })(req, res, next);
});
router.get(
  '/linkedin/callback',
  passport.authenticate('linkedin', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/profile?error=linkedin_failed`,
  }),
  async (req, res) => {
    const callerToken = req.cookies?.linkedin_link_token || '';
    res.clearCookie('linkedin_link_token');

    const { linkedInName, profileUrl } = req.user;

    try {
      const jwt_mod = await import('jsonwebtoken');
      const decoded = jwt_mod.default.verify(callerToken, process.env.JWT_SECRET);
      const userId  = decoded.user.id;

      const profile = await User.findById(userId);
      if (!profile) return res.redirect(`${process.env.FRONTEND_URL}/profile?error=user_not_found`);

      if (!canLink(profile, 'LinkedIn')) {
        return res.redirect(`${process.env.FRONTEND_URL}/profile?error=linkedin_limit`);
      }

      const alreadyLinked = profile.linkedAccounts?.some(a => a.platform === 'LinkedIn');
      if (!alreadyLinked) {
        profile.linkedAccounts = profile.linkedAccounts || [];
        profile.linkedAccounts.push({
          platform: 'LinkedIn',
          handle: linkedInName,
          url: profileUrl,
          verifiedViaOAuth: true,
          connectedAt: new Date(),
        });
        await profile.save();
      }

      return res.redirect(
        `${process.env.FRONTEND_URL}/profile?linked=linkedin&handle=${encodeURIComponent(linkedInName)}`
      );
    } catch (err) {
      console.error('LinkedIn link error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/profile?error=linkedin_link_failed`);
    }
  }
);


router.get('/discord', (req, res, next) => {
  const userToken = req.query.token || '';
  res.cookie('discord_link_token', userToken, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  passport.authenticate('discord', {
    scope: ['identify', 'email'],
    session: false,
  })(req, res, next);
});

router.get(
  '/discord/callback',
  passport.authenticate('discord', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/profile?error=discord_failed`,
  }),
  async (req, res) => {
    const callerToken = req.cookies?.discord_link_token || '';
    res.clearCookie('discord_link_token');

    const { discordUsername, profileUrl } = req.user;

    try {
      const jwt_mod = await import('jsonwebtoken');
      const decoded = jwt_mod.default.verify(callerToken, process.env.JWT_SECRET);
      const userId  = decoded.user.id;

      const profile = await User.findById(userId);
      if (!profile) return res.redirect(`${process.env.FRONTEND_URL}/profile?error=user_not_found`);

      if (!canLink(profile, 'Discord')) {
        return res.redirect(`${process.env.FRONTEND_URL}/profile?error=discord_limit`);
      }

      const alreadyLinked = profile.linkedAccounts?.some(a => a.platform === 'Discord');
      if (!alreadyLinked) {
        profile.linkedAccounts = profile.linkedAccounts || [];
        profile.linkedAccounts.push({
          platform: 'Discord',
          handle: `@${discordUsername}`,
          url: profileUrl,
          verifiedViaOAuth: true,
          connectedAt: new Date(),
        });
        await profile.save();
      }

      return res.redirect(
        `${process.env.FRONTEND_URL}/profile?linked=discord&handle=${encodeURIComponent('@' + discordUsername)}`
      );
    } catch (err) {
      console.error('Discord link error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/profile?error=discord_link_failed`);
    }
  }
);

export default router;
