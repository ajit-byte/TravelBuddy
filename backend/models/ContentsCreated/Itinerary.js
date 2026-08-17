import mongoose from 'mongoose';

const ActivityItemSchema = new mongoose.Schema({
  dayId: { type: Number, required: true, default: 1 },
  date: { type: String, default: '' }, 
  name: { type: String, required: true },
  description: { type: String, default: '' },
  note: { type: String, default: '' }, 
  time: { type: String, default: '' },
  cost: { type: Number, default: 0 },
  location: { type: String, default: '' },
  budgetType: { type: String, enum: ['Food', 'Tour', 'Stay', 'Travel Fee', 'Shopping', 'Entertainment'], default: 'Food' },
  suggestedBy: { type: String, default: '' },
}, { _id: false });

const ItinerarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  title: { type: String, required: true },
  destinations: [{ type: String }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  budget: { type: Number, default: 0 }, 
  activities: [{ type: String }], 
  notes: { type: String, default: '' }, 
  activityItems: [ActivityItemSchema],
  tripPacts: [{ type: String }], 
  members: [{ type: String }], 
  tags: [{ type: String }], 
  image: { type: String, default: '' }, 
  isPublic: { type: Boolean, default: false },
  status: { type: String, enum: ['Draft', 'My Trips', 'Past Adventures'], default: 'Draft' }
}, { timestamps: true });

export default mongoose.model('Itinerary', ItinerarySchema);
