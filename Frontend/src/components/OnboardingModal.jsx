import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TRAVEL_TYPES = [
  { id: 'adventure', label: 'Adventure', icon: 'hiking', color: 'bg-orange-500' },
  { id: 'cultural', label: 'Cultural', icon: 'museum', color: 'bg-purple-500' },
  { id: 'beach', label: 'Beach', icon: 'beach_access', color: 'bg-blue-400' },
  { id: 'city', label: 'City', icon: 'location_city', color: 'bg-gray-600' },
  { id: 'nature', label: 'Nature', icon: 'forest', color: 'bg-green-600' },
  { id: 'food', label: 'Food', icon: 'restaurant', color: 'bg-red-500' },
  { id: 'roadtrip', label: 'Road Trip', icon: 'directions_car', color: 'bg-indigo-500' },
  { id: 'backpacking', label: 'Backpacking', icon: 'backpack', color: 'bg-teal-600' },
  { id: 'wellness', label: 'Wellness', icon: 'spa', color: 'bg-emerald-400' },
  { id: 'photography', label: 'Photography', icon: 'photo_camera', color: 'bg-slate-700' },
];

const BUDGET_OPTIONS = [
  { id: 'budget', label: 'Budget', icon: 'savings', desc: 'Hostels, street food, public transit' },
  { id: 'mid-range', label: 'Mid-Range', icon: 'payments', desc: '3-star hotels, mix of casual & nice dining' },
  { id: 'luxury', label: 'Luxury', icon: 'diamond', desc: '4/5-star hotels, fine dining, private tours' },
];

const PACE_OPTIONS = [
  { id: 'slow', label: 'Slow Travel', icon: 'self_improvement', desc: 'Immersive, fewer destinations, relaxed pace' },
  { id: 'moderate', label: 'Moderate', icon: 'directions_walk', desc: 'Balanced mix of activities and free time' },
  { id: 'fast-paced', label: 'Fast-Paced', icon: 'directions_run', desc: 'Action-packed, seeing as much as possible' },
];

const ACCOMMODATION_OPTIONS = [
  { id: 'hostel', label: 'Hostel', icon: 'bed' },
  { id: 'guesthouse', label: 'Guesthouse/B&B', icon: 'cottage' },
  { id: 'hotel', label: 'Hotel', icon: 'hotel' },
  { id: 'camping', label: 'Camping', icon: 'holiday_village' },
];

const SOCIAL_STYLES = [
  { id: 'introvert', label: 'Introvert', icon: 'headphones', desc: 'Needs solo recharge time, quiet connections' },
  { id: 'ambivert', label: 'Ambivert', icon: 'diversity_3', desc: 'Balances social time with alone time' },
  { id: 'extrovert', label: 'Extrovert', icon: 'celebration', desc: 'Loves group activities, very outgoing' },
];

const COMMON_ACTIVITIES = [
  'Hiking', 'Food Tours', 'Museums', 'Beaches', 'Nightlife', 
  'Scuba Diving', 'Photography', 'Shopping', 'Historical Sites', 
  'Surfing', 'Skiing', 'Yoga/Wellness', 'Local Markets', 'Wildlife Safari'
];

const COMMON_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 
  'Korean', 'Italian', 'Portuguese', 'Hindi', 'Arabic', 'Russian'
];

export default function OnboardingModal({ onComplete }) {
  const navigate = useNavigate();
  // Steps: 1=Basic, 2=Style, 3=Trip Prefs, 4=Activities&Social, 5=KYC
  const [step, setStep] = useState(1); 
  
  // Form State
  const [nickname, setNickname] = useState('');
  const [travelPhilosophy, setTravelPhilosophy] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [budget, setBudget] = useState('');
  const [pace, setPace] = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [activities, setActivities] = useState([]);
  const [socialStyle, setSocialStyle] = useState('');
  const [languages, setLanguages] = useState([]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleArrayItem = (setter, item) => {
    setter(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const handleNextStep = () => {
    setError('');
    if (step === 1) {
      if (!nickname.trim()) return setError('Please enter a nickname');
      setStep(2);
    } else if (step === 2) {
      if (selectedTypes.length === 0) return setError('Please select at least one travel preference');
      setStep(3);
    } else if (step === 3) {
      if (!budget || !pace || !accommodation) return setError('Please complete all selections on this page');
      setStep(4);
    } else if (step === 4) {
      if (activities.length === 0) return setError('Please select at least one activity');
      if (!socialStyle) return setError('Please select your social style');
      if (languages.length === 0) return setError('Please select at least one language');
      handleSaveProfile();
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');

    try {
      const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token || '',
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          travelPhilosophy: travelPhilosophy.trim(),
          travelPreferences: selectedTypes,
          budget,
          pace,
          accommodation,
          activities,
          socialStyle,
          languages,
          skipKYC: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.msg || 'Failed to save profile');
      }

      setStep(5); // Move to KYC prompt
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipKYC = () => {
    onComplete?.();
  };

  const handleBecomeVerified = () => {
    onComplete?.();
    navigate('/verification');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-3xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Progress Bar (hide on KYC step) */}
        {step < 5 && (
          <div className="w-full bg-surface-container-low h-2">
            <div 
              className="bg-primary h-full transition-all duration-300" 
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        )}

        <div className="p-6 md:p-10 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-error-container/20 border border-error rounded-2xl flex items-center gap-3">
              <span className="material-symbols-outlined text-error">error</span>
              <span className="text-error font-semibold text-sm">{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <span className="material-symbols-outlined text-4xl text-primary">person_add</span>
                </div>
                <h2 className="text-3xl font-extrabold text-primary mb-2">Welcome to TravelBuddy!</h2>
                <p className="text-on-surface-variant">Let's personalize your travel experience.</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-on-surface mb-2">Nickname <span className="text-error">*</span></label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="How should we call you?"
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  maxLength={50}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-on-surface mb-2">Travel Philosophy</label>
                <textarea
                  value={travelPhilosophy}
                  onChange={(e) => setTravelPhilosophy(e.target.value)}
                  placeholder="What does travel mean to you? Share your philosophy..."
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                  rows={4}
                  maxLength={500}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-primary mb-2">What's your travel style?</h2>
                <p className="text-on-surface-variant">Select the tags that best describe your trips (Select multiple)</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {TRAVEL_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => toggleArrayItem(setSelectedTypes, type.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      selectedTypes.includes(type.id)
                        ? `${type.color} text-white border-transparent shadow-lg scale-105`
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:border-primary/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl">{type.icon}</span>
                    <span className="text-xs font-bold">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-primary mb-2">Trip Preferences</h2>
                <p className="text-on-surface-variant">Help our matching algorithm find you the perfect travel buddy.</p>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-3">Budget <span className="text-error">*</span></label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {BUDGET_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setBudget(opt.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${budget === opt.id ? 'border-primary bg-primary/5 shadow-md' : 'border-outline-variant/30 bg-surface hover:border-primary/50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`material-symbols-outlined ${budget === opt.id ? 'text-primary' : 'text-outline'}`}>{opt.icon}</span>
                          <span className="font-bold text-sm">{opt.label}</span>
                        </div>
                        <p className="text-xs text-outline leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface mb-3">Pace <span className="text-error">*</span></label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {PACE_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setPace(opt.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${pace === opt.id ? 'border-primary bg-primary/5 shadow-md' : 'border-outline-variant/30 bg-surface hover:border-primary/50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`material-symbols-outlined ${pace === opt.id ? 'text-primary' : 'text-outline'}`}>{opt.icon}</span>
                          <span className="font-bold text-sm">{opt.label}</span>
                        </div>
                        <p className="text-xs text-outline leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface mb-3">Preferred Accommodation <span className="text-error">*</span></label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {ACCOMMODATION_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setAccommodation(opt.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 ${accommodation === opt.id ? 'border-primary bg-primary/5 shadow-md text-primary' : 'border-outline-variant/30 bg-surface hover:border-primary/50 text-outline'}`}
                      >
                        <span className="material-symbols-outlined">{opt.icon}</span>
                        <span className="font-bold text-xs">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-primary mb-2">Final Details</h2>
                <p className="text-on-surface-variant">Just a few more things about you.</p>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-3">Favorite Activities <span className="text-error">*</span></label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ACTIVITIES.map(act => (
                      <button
                        key={act}
                        onClick={() => toggleArrayItem(setActivities, act)}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                          activities.includes(act)
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-surface border-outline-variant/30 text-on-surface hover:border-primary/50'
                        }`}
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface mb-3">Social Style <span className="text-error">*</span></label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {SOCIAL_STYLES.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSocialStyle(opt.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${socialStyle === opt.id ? 'border-primary bg-primary/5 shadow-md' : 'border-outline-variant/30 bg-surface hover:border-primary/50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`material-symbols-outlined ${socialStyle === opt.id ? 'text-primary' : 'text-outline'}`}>{opt.icon}</span>
                          <span className="font-bold text-sm">{opt.label}</span>
                        </div>
                        <p className="text-xs text-outline leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface mb-3">Languages Spoken <span className="text-error">*</span></label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_LANGUAGES.map(lang => (
                      <button
                        key={lang}
                        onClick={() => toggleArrayItem(setLanguages, lang)}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                          languages.includes(lang)
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-surface border-outline-variant/30 text-on-surface hover:border-primary/50'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/10 mb-4">
                  <span className="material-symbols-outlined text-4xl text-secondary">verified_user</span>
                </div>
                <h2 className="text-3xl font-extrabold text-primary mb-2">Become a Verified Traveler</h2>
                <p className="text-on-surface-variant max-w-md mx-auto">
                  Get verified to unlock exclusive features, build trust with the community, and access premium travel opportunities.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="flex items-start gap-3 p-4 bg-surface-container-low rounded-2xl">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <div>
                    <h4 className="font-bold text-on-surface text-sm">Verified Badge</h4>
                    <p className="text-xs text-outline">Stand out with a trusted traveler badge</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-surface-container-low rounded-2xl">
                  <span className="material-symbols-outlined text-secondary">security</span>
                  <div>
                    <h4 className="font-bold text-on-surface text-sm">Enhanced Safety</h4>
                    <p className="text-xs text-outline">Build trust with verified identity</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-surface-container-low rounded-2xl">
                  <span className="material-symbols-outlined text-secondary">workspace_premium</span>
                  <div>
                    <h4 className="font-bold text-on-surface text-sm">Premium Access</h4>
                    <p className="text-xs text-outline">Unlock exclusive travel features</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-surface-container-low rounded-2xl">
                  <span className="material-symbols-outlined text-secondary">groups</span>
                  <div>
                    <h4 className="font-bold text-on-surface text-sm">Priority Matching</h4>
                    <p className="text-xs text-outline">Connect with verified travelers first</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <button
                  onClick={handleBecomeVerified}
                  className="flex-1 bg-gradient-to-r from-secondary to-tertiary text-white font-bold py-4 rounded-full shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">verified</span>
                  Become Verified
                </button>
                <button
                  onClick={handleSkipKYC}
                  className="flex-1 bg-surface-container-low text-on-surface font-bold py-4 rounded-full border-2 border-outline-variant/30 hover:bg-surface-container-high transition-all"
                >
                  I'll do it later
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step < 5 && (
          <div className="border-t border-outline-variant/20 p-6 bg-surface-container-low/50 flex justify-between items-center">
            {step > 1 ? (
              <button 
                onClick={() => setStep(s => s - 1)}
                className="text-primary font-bold hover:bg-primary/10 px-6 py-3 rounded-full transition-all"
              >
                Back
              </button>
            ) : <div></div>}
            
            <button
              onClick={handleNextStep}
              disabled={saving}
              className="bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  {step === 4 ? 'Save Profile' : 'Continue'}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
