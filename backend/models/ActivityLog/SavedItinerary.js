import mongoose from 'mongoose';

const SavedItinerarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  itinerary: { type: mongoose.Schema.Types.ObjectId, ref: 'Itinerary', required: true },
}, { timestamps: true });

SavedItinerarySchema.index({ user: 1, itinerary: 1 }, { unique: true });

export default mongoose.model('SavedItinerary', SavedItinerarySchema);
