import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  type: {
    type: String,
    enum: ['follow_request', 'follow_accepted', 'trip_join_request', 'trip_join_accepted', 'trip_join_declined', 'system_update', 'trip_update', 'verification_request', 'verification_approved', 'verification_rejected', 'review_request'],
    required: true,
  },
  itinerary: { type: mongoose.Schema.Types.ObjectId, ref: 'Itinerary' },
  message: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'read', 'archived'],
    default: 'pending',
  },
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ sender: 1, recipient: 1, type: 1, status: 1 });

export default mongoose.model('Notification', NotificationSchema);
