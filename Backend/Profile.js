import mongoose from 'mongoose';

const ProfileSchema = new mongoose.Schema({
  nickname: { type: String, default: '' },
  profileIconUrl: { type: String, default: '' },
  coverImageUrl: { type: String, default: '' },
  bio: { type: String, default: '' },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNo: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
  travelPhilosophy: { type: String, default: '' },
  travelPreferences: [{ type: String }], 
  budget: { type: String, default: '' },
  pace: { type: String, default: '' },
  accommodation: { type: String, default: '' },
  activities: [{ type: String }],
  socialStyle: { type: String, default: '' },
  languages: [{ type: String }],
  trips: [{
    destination: String,
    startDate: Date,
    endDate: Date
  }],
  onboardingComplete: { type: Boolean, default: false },
  privacySettings: {
    showLocation: { type: Boolean, default: true },
    publicReviews: { type: Boolean, default: true },
    stealthMode: { type: Boolean, default: false },
    showBadges: { type: Boolean, default: true },
  },
  linkedAccounts: [{
    platform: { type: String },
    handle:   { type: String, default: '' }, // email, username, or profile URL
    url:      { type: String, default: '' },
    verifiedViaOAuth: { type: Boolean, default: false },
    connectedAt: { type: Date, default: Date.now },
  }],
  webSettings: {
    language: { type: String, default: 'en' },
    fontSize: { type: String, default: 'medium' },
    compactView: { type: Boolean, default: false },
    muteNotifications: { type: Boolean, default: false },
    muteUntil: { type: Date, default: null },
  },
}, { timestamps: true });

export default mongoose.model('Profile', ProfileSchema);
