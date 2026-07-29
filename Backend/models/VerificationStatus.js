import mongoose from 'mongoose';

const VerificationStatusSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true, unique: true },
  status: { type: String, enum: ['none', 'pending', 'verified', 'unverified'], default: 'none' },
  fullName: { type: String },
  dateOfBirth: { type: Date },
  temporaryAddress: { type: String },
  permanentAddress: { type: String },
  country: { type: String },
  documentType: { type: String, default: 'national_id' },
  frontImageUrl: { type: String },
  backImageUrl: { type: String },
  submittedAt: { type: Date },
  reviewedAt: { type: Date },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('VerificationStatus', VerificationStatusSchema);
