import mongoose from 'mongoose';

const ChatThreadSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true }],
  lastMessage:  { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  unreadCount:  { type: Map, of: Number, default: {} },
  title:        { type: String }, // For group names (e.g., trip title)
  isGroup:      { type: Boolean, default: false },
  itinerary:    { type: mongoose.Schema.Types.ObjectId, ref: 'Itinerary' }, // Link to trip
}, { timestamps: true });

export default mongoose.model('ChatThread', ChatThreadSchema);
