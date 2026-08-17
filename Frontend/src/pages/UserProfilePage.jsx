import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState({ following: false, requested: false, friends: false });
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trips'); // Added missing state
  const [locationLabel, setLocationLabel] = useState("Staying private");

  const token = () => JSON.parse(localStorage.getItem('authTokens'))?.token;

  // Redirect to own profile page if viewing self
  useEffect(() => {
    if (me?.id && userId === me.id) {
      navigate('/profile', { replace: true });
    }
  }, [userId, me?.id, navigate]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/${userId}`, {
          headers: { 'x-auth-token': token() || '' },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setFollowStatus(data.followStatus || { following: false, requested: false, friends: false });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) load();
  }, [userId]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLabel("Staying private");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=10`, { headers: { 'Accept-Language': 'en' } });
          if (!res.ok) return;
          const data = await res.json();
          const addr = data.address || {};
          const place = addr.county || addr.city_district || addr.city || addr.town || addr.state;
          if (place) setLocationLabel(`Active in ${place}`);
          else setLocationLabel("Staying private");
        } catch (_) { setLocationLabel("Staying private"); }
      },
      () => { setLocationLabel("Staying private"); },
      { timeout: 5000, maximumAge: 300000 }
    );
  }, []);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/follow/${userId}`, {
        method: 'POST',
        headers: { 'x-auth-token': token() || '' },
      });
      if (res.ok) setFollowStatus(prev => ({ ...prev, requested: true }));
    } catch (err) { console.error(err); }
    finally { setFollowLoading(false); }
  };

  const handleUnfollow = async () => {
    setFollowLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/unfollow/${userId}`, {
        method: 'POST',
        headers: { 'x-auth-token': token() || '' },
      });
      if (res.ok) setFollowStatus({ following: false, requested: false, friends: false });
    } catch (err) { console.error(err); }
    finally { setFollowLoading(false); }
  };

  const followBtn = () => {
    if (followStatus.friends || followStatus.following) {
      return { label: 'Unfollow', action: handleUnfollow, style: 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600' };
    }
    if (followStatus.requested) {
      return { label: 'Requested', action: null, style: 'bg-gray-100 text-gray-400 cursor-default' };
    }
    return { label: 'Follow', action: handleFollow, style: 'bg-gray-900 text-white hover:bg-gray-700' };
  };

  const displayName = profile?.nickname || profile?.username || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const btn = followBtn();

  return (
    <div className="min-h-screen bg-gray-100 pt-20">
      <Navbar />

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !profile ? (
        <div className="text-center py-32 text-gray-500">
          <p className="text-xl font-medium">User not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-accent font-bold hover:underline">Go back</button>
        </div>
      ) : (
        <main className="min-h-screen pb-32 bg-surface text-on-surface">
          {/* Hero Header with Avatar */}
          <header className="relative h-64 w-full bg-primary overflow-hidden">
            <div className="absolute inset-0 opacity-40 mix-blend-overlay">
              {profile.coverImageUrl && (
                 <img alt="Cover" className="w-full h-full object-cover" src={profile.coverImageUrl} />
              )}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-surface to-transparent"></div>
          </header>

          <div className="max-w-5xl mx-auto px-6 -mt-20 relative z-10">
            {/* Profile Info Overlay */}
            <div className="flex flex-col md:flex-row items-end md:items-center gap-6 mb-12">
              <div className="relative group">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl border-4 border-surface overflow-hidden shadow-2xl bg-surface-container-lowest flex items-center justify-center font-black text-5xl text-accent-text bg-accent">
                    {profile.profileIconUrl ? (
                      <img alt="User profile photo" className="w-full h-full object-cover" src={profile.profileIconUrl} />
                    ) : initial}
                </div>
                {profile.isVerified && (
                  <div className="absolute -bottom-2 -right-2 bg-secondary-fixed text-on-secondary-fixed p-2 rounded-xl shadow-lg flex items-center justify-center border-2 border-surface">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                )}
              </div>

              <div className="flex-1 md:pb-4 text-right md:text-left">
                <div className="flex items-center justify-end md:justify-start gap-3 mb-1">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-primary">
                      {displayName}
                  </h1>
                  {profile.isVerified && (
                    <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-fixed text-on-secondary-fixed rounded-full text-xs font-bold uppercase tracking-widest">
                      <span className="material-symbols-outlined text-sm">verified_user</span>
                      Trusted Explorer
                    </span>
                  )}
                </div>
                <p className="text-on-surface-variant font-medium flex items-center justify-end md:justify-start gap-2">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  {locationLabel} • Member since {profile.createdAt ? new Date(profile.createdAt).getFullYear() : '2021'}
                </p>
              </div>

              <div className="flex gap-3 md:pb-4">
                <button 
                  onClick={btn.action || undefined}
                  disabled={!btn.action || followLoading}
                  className={`px-8 py-3 rounded-full font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-60 ${btn.style.includes('bg-gray-100') ? 'bg-surface-container-low text-on-surface-variant' : 'bg-primary text-white hover:brightness-110 active:scale-95'}`}
                >
                  <span className="material-symbols-outlined">
                    {btn.label === 'Unfollow' ? 'person_remove' : btn.label === 'Requested' ? 'how_to_reg' : btn.label === 'Friends' ? 'group' : 'person_add'}
                  </span>
                  {followLoading ? '...' : btn.label}
                </button>
                {(followStatus.requested || followStatus.following || followStatus.friends) && (
                  <button 
                    onClick={() => navigate('/chatpage', { state: { openThread: userId } })}
                    className="px-8 py-3 rounded-full font-bold shadow-lg transition-all flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed hover:brightness-110 active:scale-95"
                  >
                    <span className="material-symbols-outlined">chat</span>
                    Message
                  </button>
                )}
              </div>
            </div>

            {/* Bento Layout Sections */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Left Column: Trust & Socials */}
              <div className="md:col-span-4 space-y-8">
                {/* Trust Summary */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(30,58,138,0.04)] border border-outline-variant/10">
                  <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl">verified</span>
                    Trust & Ratings
                  </h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-3xl font-black text-primary">4.9</span>
                        <div className="flex text-[#F59E0B]">
                          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-outline font-bold uppercase tracking-wider">124 Reviews</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-on-surface-variant font-medium">Identity</span>
                        <span className="text-secondary font-bold">{profile.isVerified ? 'Verified' : 'Not Verified'}</span>
                      </div>
                      <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                        <div className={`bg-secondary h-full ${profile.isVerified ? 'w-full' : 'w-0'}`}></div>
                      </div>

                      <div className="flex items-center justify-between text-sm pt-2">
                        <span className="text-on-surface-variant font-medium">Safety Score</span>
                        <span className="text-secondary font-bold">98/100</span>
                      </div>
                      <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                        <div className="bg-secondary h-full w-[98%]"></div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Verification Links */}
                <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10">
                  <h3 className="text-lg font-bold text-primary mb-6">Social Verifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#1E3A8A]">account_circle</span>
                        <span className="text-sm font-bold">Google account</span>
                      </div>
                      <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#0EA5E9]">public</span>
                        <span className="text-sm font-bold">Twitter / X</span>
                      </div>
                      <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column: Bio & Preferences */}
              <div className="md:col-span-8 space-y-8">
                {/* Stats Row */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(30,58,138,0.04)] border border-outline-variant/10">
                  <div className="flex gap-10">
                    {[
                      { label: 'Posts', value: profile.stats?.posts ?? 0 },
                      { label: 'Trips', value: profile.stats?.trips ?? 0 },
                      { label: 'Followers', value: profile.stats?.followers ?? 0 },
                      { label: 'Following', value: profile.stats?.following ?? 0 },
                    ].map(stat => (
                      <div key={stat.label} className="flex flex-col items-center">
                        <span className="text-3xl font-black text-gray-900">{stat.value.toLocaleString()}</span>
                        <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </section>
                
                {/* Bio Section */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(30,58,138,0.04)] border border-outline-variant/10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-extrabold text-primary tracking-tight">Travel Philosophy</h3>
                  </div>
                  <div className="prose prose-slate max-w-none text-on-surface-variant leading-relaxed space-y-4">
                      {profile?.bio ? (
                          <p className="text-lg font-body">{profile.bio}</p>
                      ) : (
                          <>
                            <p className="text-lg font-body">
                                "I believe that solo travel is the ultimate path to self-discovery. My journey began in the narrow alleys of Kyoto and hasn't stopped since."
                            </p>
                            <p>
                                When I travel, I seek the intersection of local culture and hidden natural wonders. I'm less interested in the five-star hotel lobby and more in the conversation over a street-side coffee or the trail that isn't on the main map. My philosophy is to leave every place a little better than I found it.
                            </p>
                          </>
                      )}
                  </div>
                </section>

                {/* Style Tags */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(30,58,138,0.04)] border border-outline-variant/10">
                  <h3 className="text-lg font-bold text-primary mb-6">Travel Identity</h3>
                  <div className="flex flex-wrap gap-3">
                    <span className="px-5 py-2.5 bg-tertiary-fixed text-on-tertiary-fixed rounded-full text-sm font-bold flex items-center gap-2 hover:brightness-105 cursor-default">
                      <span className="material-symbols-outlined text-base">hiking</span>
                      Adventure
                    </span>
                    <span className="px-5 py-2.5 bg-secondary-fixed text-on-secondary-fixed rounded-full text-sm font-bold flex items-center gap-2 hover:brightness-105 cursor-default">
                      <span className="material-symbols-outlined text-base">restaurant</span>
                      Foodie
                    </span>
                    <span className="px-5 py-2.5 bg-primary-fixed text-on-primary-fixed rounded-full text-sm font-bold flex items-center gap-2 hover:brightness-105 cursor-default">
                      <span className="material-symbols-outlined text-base">camera</span>
                      Photography
                    </span>
                    <span className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant rounded-full text-sm font-bold hover:bg-surface-container-high cursor-default flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">diamond</span>
                      Luxury
                    </span>
                    <span className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant rounded-full text-sm font-bold hover:bg-surface-container-high cursor-default flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">history_edu</span>
                      Culture
                    </span>
                  </div>
                </section>
              </div>
            </div>

            {/* Community Badges Section */}
            <section className="mt-8 bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(30,58,138,0.04)] border border-outline-variant/20 relative overflow-hidden">
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h3 className="text-xl font-extrabold text-primary tracking-tight">Badges provided by other verified travelers</h3>
                <div className="hidden sm:flex items-center gap-2 text-on-surface-variant/60">
                  <span className="material-symbols-outlined text-lg">diversity_3</span>
                  <span className="text-xs font-bold uppercase tracking-widest">Community Endorsed</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 relative z-10">
                
                <div className="flex flex-col items-center p-4 bg-surface-container-low rounded-2xl hover:bg-primary-fixed transition-colors cursor-default group">
                  <div className="relative mb-3 group-hover:scale-110 transition-transform">
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">volunteer_activism</span>
                    </div>
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-surface-container-low">12</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface text-center mb-2">Frequent Helper</span>
                  <div className="flex -space-x-2 overflow-hidden">
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-amber-500 text-white text-[8px] font-bold">U1</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-blue-500 text-white text-[8px] font-bold">U2</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-purple-500 text-white text-[8px] font-bold">U3</div>
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 bg-surface-container-low rounded-2xl hover:bg-secondary-fixed transition-colors cursor-default group">
                  <div className="relative mb-3 group-hover:scale-110 transition-transform">
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary">health_and_safety</span>
                    </div>
                    <span className="absolute -top-1 -right-1 bg-secondary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-surface-container-low">8</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface text-center mb-2">Safety First</span>
                  <div className="flex -space-x-2 overflow-hidden">
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-green-500 text-white text-[8px] font-bold">U4</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-red-500 text-white text-[8px] font-bold">U5</div>
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 bg-surface-container-low rounded-2xl hover:bg-tertiary-fixed transition-colors cursor-default group">
                  <div className="relative mb-3 group-hover:scale-110 transition-transform">
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-tertiary">groups</span>
                    </div>
                    <span className="absolute -top-1 -right-1 bg-tertiary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-surface-container-low">24</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface text-center mb-2">Top Companion</span>
                  <div className="flex -space-x-2 overflow-hidden">
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-indigo-500 text-white text-[8px] font-bold">U6</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-pink-500 text-white text-[8px] font-bold">U7</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-teal-500 text-white text-[8px] font-bold">U8</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-white text-gray-500 text-[8px] font-bold">+18</div>
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 bg-surface-container-low rounded-2xl hover:bg-primary-fixed transition-colors cursor-default group">
                  <div className="relative mb-3 group-hover:scale-110 transition-transform">
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">map</span>
                    </div>
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-surface-container-low">15</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface text-center mb-2">Pathfinder</span>
                  <div className="flex -space-x-2 overflow-hidden">
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-orange-500 text-white text-[8px] font-bold">U9</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-lime-500 text-white text-[8px] font-bold">U1</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-white text-gray-500 text-[8px] font-bold">+13</div>
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 bg-surface-container-low rounded-2xl hover:bg-secondary-fixed transition-colors cursor-default group">
                  <div className="relative mb-3 group-hover:scale-110 transition-transform">
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary">local_activity</span>
                    </div>
                    <span className="absolute -top-1 -right-1 bg-secondary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-surface-container-low">31</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface text-center mb-2">Local Expert</span>
                  <div className="flex -space-x-2 overflow-hidden">
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-cyan-700 text-white text-[8px] font-bold">U2</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-purple-700 text-white text-[8px] font-bold">U3</div>
                    <div className="inline-flex items-center justify-center h-5 w-5 rounded-full ring-2 ring-surface-container-low bg-white text-gray-500 text-[8px] font-bold">+29</div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </main>
      )}
    </div>
  );
}
