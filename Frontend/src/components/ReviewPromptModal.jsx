import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Shown once on the dashboard when a user has a finished joined trip
 * that they haven't reviewed yet.
 *
 * Props:
 *   itinerary: { _id, title, endDate }
 *   onSkip:    () => void  — called after snooze API succeeds
 *   onDismiss: () => void  — called to close without any action (shouldn't happen normally)
 */
export default function ReviewPromptModal({ itinerary, onSkip, onDismiss }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const token = () => JSON.parse(localStorage.getItem('authTokens'))?.token;

  const handleSkip = async () => {
    setLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/reviews/snooze/${itinerary._id}`, {
        method: 'POST',
        headers: { 'x-auth-token': token() || '' },
      });
    } catch { /* ignore */ }
    setLoading(false);
    onSkip();
  };

  const handleReview = () => {
    onDismiss();
    navigate('/review', { state: { itineraryId: itinerary._id, itineraryTitle: itinerary.title } });
  };

  const endDate = itinerary.endDate
    ? new Date(itinerary.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-primary to-secondary px-8 py-6">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>rate_review</span>
          </div>
          <h2 className="text-white font-extrabold text-xl tracking-tight">How was your trip?</h2>
          <p className="text-white/80 text-sm mt-1">Your journey has ended — share your experience!</p>
        </div>

        <div className="px-8 py-6">
          {/* Trip info */}
          <div className="bg-surface-container-low rounded-2xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>flight_land</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-on-surface truncate">{itinerary.title}</p>
              {endDate && <p className="text-xs text-outline">Ended {endDate}</p>}
            </div>
          </div>

          <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
            You were part of this trip. Your review helps the planner improve and guides future travelers. It only takes a minute!
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              disabled={loading}
              className="flex-1 bg-surface-container-low text-on-surface-variant py-3.5 rounded-2xl font-bold hover:bg-surface-container transition-all disabled:opacity-50 text-sm"
            >
              {loading ? '...' : 'Skip for now'}
            </button>
            <button
              onClick={handleReview}
              className="flex-1 bg-gradient-to-br from-primary to-secondary text-white py-3.5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 text-sm"
            >
              Let's Review ✍️
            </button>
          </div>

          <p className="text-center text-[11px] text-outline mt-3">
            Skipping will remind you again tomorrow.
          </p>
        </div>
      </div>
    </div>
  );
}
