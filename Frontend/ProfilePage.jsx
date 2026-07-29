import { useState, useEffect, useContext, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { useWebSettings } from '../context/WebSettingsContext';
import { useToast } from '../context/ToastContext';

export default function ProfilePage() {
  const { user, profile: ctxProfile, refreshProfile, logout } = useContext(AuthContext);
  const { t } = useWebSettings();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [locationLabel, setLocationLabel] = useState("Staying private");
  const [activeTab, setActiveTab] = useState('profile');
  const [privacySettings, setPrivacySettings] = useState({ showLocation: true, publicReviews: true, stealthMode: false, showBadges: true });
  const [showLinkedModal, setShowLinkedModal] = useState(false);
  const [webSettings, setWebSettings] = useState({ language: 'en', fontSize: 'medium', compactView: false, muteNotifications: false, muteUntil: null });
  const [savingSettings, setSavingSettings] = useState(false);
  const [trustStats, setTrustStats] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const editCoverRef = useRef(null);
  const editAvatarRef = useRef(null);

  const MAX_COVER_MB = 3;
  const MAX_AVATAR_MB = 2;

  const token = () => JSON.parse(localStorage.getItem('authTokens'))?.token;

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/me`, {
        headers: { 'x-auth-token': token() || '' },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditForm({
          nickname: data.nickname || '',
          username: data.username || '',
          email: data.email || '',
          travelPhilosophy: data.travelPhilosophy || data.bio || '',
          phoneNo: data.phoneNo || '',
          coverImageUrl: data.coverImageUrl || '',
          profileIconUrl: data.profileIconUrl || '',
        });
        if (data.privacySettings) setPrivacySettings(data.privacySettings);
        if (data.webSettings) setWebSettings(prev => ({ ...prev, ...data.webSettings }));

        // Fetch trust stats and recent reviews in parallel
        const [statsRes, reviewsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/reviews/stats/${data._id}`, {
            headers: { 'x-auth-token': token() || '' },
          }),
          fetch(`${import.meta.env.VITE_API_URL}/api/reviews/itinerary/by-owner/${data._id}?limit=3`, {
            headers: { 'x-auth-token': token() || '' },
          }),
        ]);
        if (statsRes.ok) setTrustStats(await statsRes.json());
        if (reviewsRes.ok) setRecentReviews(await reviewsRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);
 
  useEffect(() => {
    if (location.state?.openEdit) {
      setShowEditModal(true);
      window.history.replaceState({}, document.title);
    }
    if (location.state?.tab === 'web') {
      setActiveTab('web');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Handle return from Google/GitHub OAuth link flow
  useEffect(() => {
    const linked  = searchParams.get('linked');
    const email   = searchParams.get('email');
    const handle  = searchParams.get('handle');
    const error   = searchParams.get('error');

    if (linked === 'gmail' && email) {
      showToast(`Gmail ${email} linked successfully`, 'success');
      fetchProfile();
      navigate('/profile', { replace: true });
    } else if (linked === 'github' && handle) {
      showToast(`GitHub ${handle} linked successfully`, 'success');
      fetchProfile();
      navigate('/profile', { replace: true });
    } else if (linked === 'linkedin' && handle) {
      showToast(`LinkedIn account "${handle}" linked successfully`, 'success');
      fetchProfile();
      navigate('/profile', { replace: true });
    } else if (linked === 'discord' && handle) {
      showToast(`Discord ${handle} linked successfully`, 'success');
      fetchProfile();
      navigate('/profile', { replace: true });
    } else if (error) {
      const msgs = {
        gmail_limit:          'You can link up to 5 Gmail accounts.',
        github_limit:         'GitHub account already linked.',
        linkedin_limit:       'LinkedIn account already linked.',
        discord_limit:        'Discord account already linked.',
        linkedin_failed:      'LinkedIn authorisation failed. Please try again.',
        discord_failed:       'Discord authorisation failed. Please try again.',
      };
      showToast(msgs[error] || 'Failed to link account. Please try again.', 'error');
      navigate('/profile', { replace: true });
    }
  }, []);

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


  // Upload a file to Cloudinary via backend and return the URL
  const uploadImage = async (file, folder) => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('folder', folder);
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/upload-image`, {
      method: 'POST',
      headers: { 'x-auth-token': token() || '' },
      body: fd,
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = { ...editForm };
      if (coverFile) updates.coverImageUrl = await uploadImage(coverFile, 'covers');
      if (avatarFile) updates.profileIconUrl = await uploadImage(avatarFile, 'avatars');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token() || '' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setCoverFile(null); setCoverPreview(null);
        setAvatarFile(null); setAvatarPreview(null);
        await fetchProfile();
        await refreshProfile();
        setShowEditModal(false);
      }
    } catch (err) {
      console.error(err);
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      setErrors(p => ({ ...p, cover: `Cover image must be under ${MAX_COVER_MB}MB` }));
      e.target.value = '';
      return;
    }
    setErrors(p => ({ ...p, cover: null }));
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setErrors(p => ({ ...p, avatar: `Profile photo must be under ${MAX_AVATAR_MB}MB` }));
      e.target.value = '';
      return;
    }
    setErrors(p => ({ ...p, avatar: null }));
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const initial = profile?.nickname?.charAt(0)?.toUpperCase()
    || profile?.username?.charAt(0)?.toUpperCase()
    || user?.username?.charAt(0)?.toUpperCase() || '?';

  const coverSrc = coverPreview || profile?.coverImageUrl || null;
  const avatarSrc = avatarPreview || profile?.profileIconUrl || null;

  const savePrivacySettings = async (newSettings) => {
    setPrivacySettings(newSettings);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token() || '' },
        body: JSON.stringify({ privacySettings: newSettings }),
      });
      if (res.ok) {
        refreshProfile();
      }
    } catch (err) { console.error(err); }
  };

  const saveWebSettings = async (newSettings) => {
    setWebSettings(newSettings);
    setSavingSettings(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token() || '' },
        body: JSON.stringify({ webSettings: newSettings }),
      });
      if (res.ok) {
        refreshProfile();
      }
    } catch (err) { console.error(err); }
    finally { setSavingSettings(false); }
  };

  const saveLinkedAccount = async (platform) => {
    const existing = profile?.linkedAccounts || [];
    const alreadyLinked = existing.some(a => a.platform === platform.name);
    if (alreadyLinked) return;
    const updated = [...existing, { platform: platform.name, url: platform.url }];
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token() || '' },
        body: JSON.stringify({ linkedAccounts: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(p => ({ ...p, linkedAccounts: data.linkedAccounts }));
      }
    } catch (err) { console.error(err); }
  };

  const removeLinkedAccount = async (platformName, handle) => {
    // Remove by platform + handle so multiple Gmail accounts don't all get wiped
    const updated = (profile?.linkedAccounts || []).filter(
      a => !(a.platform === platformName && (handle ? a.handle === handle : true))
    );
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token() || '' },
        body: JSON.stringify({ linkedAccounts: updated }),
      });
      if (res.ok) setProfile(p => ({ ...p, linkedAccounts: updated }));
    } catch (err) { console.error(err); }
  };

  const linkedAccountPlatforms = [
    { name: 'Gmail',    svgGoogle:   true, bgColor: 'bg-white border border-gray-200' },
    { name: 'GitHub',   svgGitHub:   true, bgColor: 'bg-gray-900' },
    { name: 'LinkedIn', svgLinkedIn: true, bgColor: 'bg-[#0A66C2]' },
    { name: 'Discord',  svgDiscord:  true, bgColor: 'bg-[#5865F2]' },
  ];

  // Trigger Google OAuth link flow — passes the user's JWT as state
  const linkGmail = () => {
    const tokenData = localStorage.getItem('authTokens');
    if (!tokenData) return;
    const { token } = JSON.parse(tokenData);
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google?mode=link&token=${encodeURIComponent(token)}`;
  };

  // Trigger GitHub OAuth link flow
  const linkGitHub = () => {
    const tokenData = localStorage.getItem('authTokens');
    if (!tokenData) return;
    const { token } = JSON.parse(tokenData);
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/github?token=${encodeURIComponent(token)}`;
  };

  // Trigger LinkedIn OAuth link flow
  const linkLinkedIn = () => {
    const tokenData = localStorage.getItem('authTokens');
    if (!tokenData) return;
    const { token } = JSON.parse(tokenData);
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/linkedin?token=${encodeURIComponent(token)}`;
  };

  // Trigger Discord OAuth link flow
  const linkDiscord = () => {
    const tokenData = localStorage.getItem('authTokens');
    if (!tokenData) return;
    const { token } = JSON.parse(tokenData);
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/discord?token=${encodeURIComponent(token)}`;
  };

  // Build the auto-verified entries from the user's own profile data
  const autoVerifiedAccounts = [
    profile?.email && {
      platform: 'Email',
      handle: profile.email,
      icon: 'mail',
      color: 'bg-emerald-600',
      isAutoVerified: true,
    },
    profile?.phoneNo && {
      platform: 'Phone',
      handle: profile.phoneNo,
      icon: 'phone',
      color: 'bg-teal-600',
      isAutoVerified: true,
    },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-100 pt-20">
      <Navbar />

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex">
          {/* New Sidebar Sections (Left Column) */}
          <aside className="hidden md:flex flex-col w-72 h-[calc(100vh-5rem)] sticky top-20 p-6 border-r border-outline-variant/10 bg-surface-container-lowest">
            <div className="flex-1 space-y-6">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-outline mb-4 px-2">{t('Settings')}</h3>
                <div className="space-y-1">
                  <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'profile' ? 'bg-primary-fixed/30 text-primary' : 'text-on-surface/60 hover:bg-surface-container-low'}`}>
                    <span className="material-symbols-outlined">person</span>
                    <span>{t('Profile Settings')}</span>
                  </button>
                  <button onClick={() => setActiveTab('web')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'web' ? 'bg-primary-fixed/30 text-primary' : 'text-on-surface/60 hover:bg-surface-container-low'}`}>
                    <span className="material-symbols-outlined">language</span>
                    <span>{t('Web Settings')}</span>
                  </button>
                </div>
              </section>
            </div>
            
            <div className="pt-6 border-t border-outline-variant/10 space-y-1">
              <a href="mailto:TravelBuddy10@gmail.com" className="flex items-center gap-3 px-4 py-3 text-on-surface/60 hover:bg-surface-container-low rounded-xl transition-colors font-medium">
                <span className="material-symbols-outlined">help</span>
                <span>{t('Support')}</span>
              </a>
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 text-error hover:bg-error-container/20 rounded-xl transition-colors font-bold"
              >
                <span className="material-symbols-outlined">logout</span>
                <span>{t('Logout')}</span>
              </button>
            </div>
          </aside>
          <main className="flex-1 min-h-screen pb-32 bg-surface text-on-surface">
          
          {activeTab === 'profile' ? (
          <>
          {/* Hero Header with Avatar */}
          <header className="relative h-64 w-full bg-primary overflow-hidden">
            {coverSrc ? (
              <img alt="Cover" className="w-full h-full object-cover" src={coverSrc} />
            ) : (
              <div className="absolute inset-0 bg-primary"></div>
            )}
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-surface to-transparent"></div>
            {/* Camera icon — top right */}
            <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors z-10"
                title="Change cover photo"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
          </header>

          <div className="max-w-5xl mx-auto px-6 -mt-20 relative z-10">
            {/* Profile Info Overlay */}
            <div className="flex flex-col md:flex-row items-end md:items-center gap-6 mb-12">
              <div className="relative group cursor-pointer" onClick={() => editAvatarRef.current?.click()}>
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl border-4 border-surface overflow-hidden shadow-2xl bg-surface-container-lowest flex items-center justify-center font-black text-5xl">
                    {avatarSrc ? (
                      <img alt="User profile photo" className="w-full h-full object-cover" src={avatarSrc} />
                    ) : initial}
                </div>
                {profile?.isVerified && (
                  <div className="absolute -bottom-2 -right-2 bg-secondary-fixed text-on-secondary-fixed p-2 rounded-xl shadow-lg flex items-center justify-center border-2 border-surface">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-3xl">photo_camera</span>
                </div>
                <input ref={editAvatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="flex-1 md:pb-4 text-right md:text-left">
                <div className="flex items-center justify-end md:justify-start gap-3 mb-1">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-primary">
                      {profile?.nickname || profile?.username || 'Traveler'}
                  </h1>
                  {profile?.isVerified && (
                    <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-fixed text-on-secondary-fixed rounded-full text-xs font-bold uppercase tracking-widest">
                      <span className="material-symbols-outlined text-sm">verified_user</span>
                      Trusted Explorer
                    </span>
                  )}
                </div>
                <p className="text-on-surface-variant font-medium flex items-center justify-end md:justify-start gap-2">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  {locationLabel} • Member since {profile?.createdAt ? (() => {
                    const joinDate = new Date(profile.createdAt);
                    const now = new Date();
                    const diffTime = Math.abs(now - joinDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 0) return 'Today';
                    if (diffDays === 1) return 'Yesterday';
                    if (diffDays < 7) return `${diffDays} days ago`;
                    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
                    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
                    return joinDate.getFullYear();
                  })() : 'Recently'}
                </p>
              </div>

              <div className="flex gap-3 md:pb-4">
                <button 
                  onClick={() => setShowEditModal(true)}
                  className="bg-surface-container-lowest text-primary px-6 py-3 rounded-full font-bold border border-outline-variant/20 hover:bg-surface-container-low transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">edit</span>
                  {t('Edit Profile')}
                </button>
              </div>
            </div>

            {/* Bento Layout Sections */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Left Column: Trust & Socials */}
              <div className="md:col-span-4 space-y-8">
                {/* Trust Summary */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(64,89,170,0.04)]">
                  <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl">verified</span>
                    {t('Trust & Ratings')}
                  </h3>

                  {/* ── Trust Score Bar ── */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-on-surface">Trust Score</span>
                      <span className="text-2xl font-black text-primary">{trustStats?.trustScore ?? 0}<span className="text-sm font-bold text-outline">/100</span></span>
                    </div>
                    <div className="w-full bg-surface-container-low h-3 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${trustStats?.trustScore ?? 0}%`,
                          background: (trustStats?.trustScore ?? 0) >= 70
                            ? 'linear-gradient(90deg,#10b981,#059669)'
                            : (trustStats?.trustScore ?? 0) >= 40
                            ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                            : 'linear-gradient(90deg,#ef4444,#dc2626)',
                        }}
                      />
                    </div>
                    {/* Score breakdown pills */}
                    {trustStats && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {[
                          { label: 'KYC', val: trustStats.breakdown?.kyc, max: 30 },
                          { label: 'Rating', val: trustStats.breakdown?.rating, max: 25 },
                          { label: 'Reviews', val: trustStats.breakdown?.reviewCount, max: 15 },
                          { label: 'Linked', val: trustStats.breakdown?.linkedAccounts, max: 20 },
                          { label: 'Profile', val: trustStats.breakdown?.completeness, max: 10 },
                        ].map(({ label, val, max }) => (
                          <div key={label} className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-full">
                            <span className="text-[9px] font-bold text-outline uppercase tracking-wide">{label}</span>
                            <span className="text-[9px] font-black text-primary">{val}/{max}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Star Rating ── */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black text-primary">{trustStats?.rating?.toFixed(1) ?? '—'}</span>
                      <div className="flex">
                        {[1,2,3,4,5].map(i => (
                          <span key={i} className="material-symbols-outlined text-lg"
                            style={{ fontVariationSettings: "'FILL' 1", color: i <= Math.round(trustStats?.rating || 0) ? '#F59E0B' : '#E5E7EB' }}>
                            star
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-sm text-outline font-bold">{trustStats?.reviews ?? 0} Reviews</span>
                  </div>

                  {/* ── Identity ── */}
                  <div className="space-y-2 mb-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-on-surface-variant font-medium">Identity</span>
                      <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${profile?.isVerified ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-surface-container text-outline'}`}>
                        {profile?.isVerified ? '✓ Verified' : 'Not Verified'}
                      </span>
                    </div>
                  </div>

                  {/* ── Top Badges ── */}
                  {trustStats?.topBadges?.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-2">Top Badges</p>
                      <div className="flex flex-wrap gap-2">
                        {trustStats.topBadges.map(({ badge, count }) => (
                          <div key={badge} className="flex items-center gap-1 bg-secondary/10 text-secondary px-2.5 py-1 rounded-full text-xs font-bold">
                            <span>{badge}</span>
                            <span className="bg-secondary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Recent Reviews ── */}
                  {recentReviews.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-outline uppercase tracking-widest">Recent Reviews</p>
                      {recentReviews.map(review => (
                        <div key={review._id} className="bg-surface-container-low rounded-2xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-surface-container shrink-0">
                              {review.reviewer?.profileIconUrl
                                ? <img src={review.reviewer.profileIconUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-primary">{(review.reviewer?.nickname || review.reviewer?.username || '?')[0].toUpperCase()}</div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-on-surface truncate">{review.reviewer?.nickname || review.reviewer?.username}</p>
                              <p className="text-[9px] text-outline truncate">{review.itineraryTitle}</p>
                            </div>
                            <div className="flex shrink-0">
                              {[1,2,3,4,5].map(i => (
                                <span key={i} className="material-symbols-outlined text-xs"
                                  style={{ fontVariationSettings: "'FILL' 1", color: i <= review.rating ? '#F59E0B' : '#E5E7EB' }}>
                                  star
                                </span>
                              ))}
                            </div>
                          </div>
                          {review.description && (
                            <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{review.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[9px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">{review.badge}</span>
                            <span className="text-[9px] text-outline">{review.plannerRating} planner</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <span className="material-symbols-outlined text-2xl text-outline mb-1 block">star_outline</span>
                      <p className="text-xs text-outline">No reviews yet — complete trips to earn them</p>
                    </div>
                  )}
                </section>

                {/* Social Verifications */}
                <section className="bg-surface-container-low p-8 rounded-3xl">
                  <h3 className="text-lg font-bold text-primary mb-6">{t('Social Verifications')}</h3>
                  <div className="space-y-3">

                    {/* ── Auto-verified: Email & Phone ── */}
                    {autoVerifiedAccounts.map((account) => (
                      <div key={account.platform} className="relative flex items-center gap-3 p-4 bg-surface-container-lowest rounded-2xl">
                        {/* Top-right verified badge */}
                        <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                          <span className="material-symbols-outlined text-emerald-500 text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Verified</span>
                        </div>
                        <div className={`w-9 h-9 shrink-0 ${account.color} text-white flex items-center justify-center rounded-xl`}>
                          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{account.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0 pr-16">
                          <span className="text-sm font-bold block text-on-surface">{account.platform}</span>
                          <span className="text-xs text-outline truncate block">{account.handle}</span>
                        </div>
                      </div>
                    ))}

                    {/* ── Divider ── */}
                    {autoVerifiedAccounts.length > 0 && profile?.linkedAccounts?.length > 0 && (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex-1 h-px bg-outline-variant/20" />
                        <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Connected</span>
                        <div className="flex-1 h-px bg-outline-variant/20" />
                      </div>
                    )}

                    {/* ── Manually linked accounts ── */}
                    {profile?.linkedAccounts?.map((account) => {
                      const meta = linkedAccountPlatforms.find(p => p.name === account.platform);
                      return (
                        <div key={`${account.platform}-${account.handle || account.url}`} className="relative flex items-center gap-3 p-4 bg-surface-container-lowest rounded-2xl">
                          {/* Top-right badge */}
                          {account.verifiedViaOAuth ? (
                            <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-emerald-500 text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Verified</span>
                            </div>
                          ) : (
                            <div className="absolute top-2 right-2">
                              <span className="material-symbols-outlined text-secondary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            </div>
                          )}
                          {/* Icon */}
                          <div className={`w-9 h-9 shrink-0 ${meta?.bgColor || 'bg-gray-500'} flex items-center justify-center rounded-xl overflow-hidden`}>
                            {meta?.svgGoogle ? (
                              <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                              </svg>
                            ) : meta?.svgGitHub ? (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                              </svg>
                            ) : meta?.svgLinkedIn ? (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            ) : meta?.svgDiscord ? (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                              </svg>
                            ) : (
                              <span className="text-white text-base">{meta?.icon || '🔗'}</span>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0 pr-16">
                            <span className="text-sm font-bold block text-on-surface">{account.platform}</span>
                            <span className="text-xs text-outline truncate block">
                              {account.handle || 'Connected'}
                            </span>
                          </div>
                          {/* Remove button */}
                          <div className="shrink-0">
                            <button
                              onClick={() => removeLinkedAccount(account.platform, account.handle)}
                              className="text-outline hover:text-error transition-colors"
                              title="Remove"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Empty state ── */}
                    {autoVerifiedAccounts.length === 0 && (!profile?.linkedAccounts || profile.linkedAccounts.length === 0) && (
                      <div className="text-center py-6">
                        <span className="material-symbols-outlined text-3xl text-outline mb-2 block">link_off</span>
                        <p className="text-sm text-outline">No linked accounts yet</p>
                      </div>
                    )}

                    <button
                      onClick={() => setShowLinkedModal(true)}
                      className="w-full p-4 border border-dashed border-outline-variant rounded-2xl text-sm font-bold text-outline hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 mt-1"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      {t('Add Linked Account')}
                    </button>
                  </div>
                </section>
              </div>

              {/* Right Column: Bio & Preferences */}
              <div className="md:col-span-8 space-y-8">
                {/* Bio Section */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(64,89,170,0.04)]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-extrabold text-primary tracking-tight">{t('Travel Philosophy')}</h3>
                    <button onClick={() => setShowEditModal(true)} className="text-secondary font-bold text-sm hover:underline">{t('Edit')}</button>
                  </div>
                  <div className="prose prose-slate max-w-none text-on-surface-variant leading-relaxed space-y-4">
                      {profile?.travelPhilosophy || profile?.bio ? (
                          <p className="text-lg font-body">{profile.travelPhilosophy || profile.bio}</p>
                      ) : (
                          <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container-low mb-4">
                              <span className="material-symbols-outlined text-3xl text-outline">edit_note</span>
                            </div>
                            <p className="text-on-surface-variant font-medium mb-2">No travel philosophy yet</p>
                            <p className="text-xs text-outline">Share your travel philosophy to connect with like-minded travelers</p>
                            <button 
                              onClick={() => setShowEditModal(true)}
                              className="mt-4 px-6 py-2 bg-primary text-white rounded-full text-sm font-bold hover:bg-primary/90 transition-colors"
                            >
                              Add Philosophy
                            </button>
                          </div>
                      )}
                  </div>
                </section>

                {/* Style Tags */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(64,89,170,0.04)]">
                  <h3 className="text-lg font-bold text-primary mb-6">{t('Travel Identity')}</h3>
                  {profile?.travelPreferences && profile.travelPreferences.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {profile.travelPreferences.map((pref) => {
                        const icons = {
                          adventure: 'hiking',
                          cultural: 'museum',
                          beach: 'beach_access',
                          city: 'location_city',
                          nature: 'forest',
                          food: 'restaurant',
                          roadtrip: 'directions_car',
                          backpacking: 'backpack',
                          budget: 'savings',
                          luxury: 'diamond'
                        };
                        const colors = {
                          adventure: 'bg-orange-500',
                          cultural: 'bg-purple-500',
                          beach: 'bg-blue-400',
                          city: 'bg-gray-600',
                          nature: 'bg-green-600',
                          food: 'bg-red-500',
                          roadtrip: 'bg-indigo-500',
                          backpacking: 'bg-teal-600',
                          budget: 'bg-yellow-600',
                          luxury: 'bg-pink-500'
                        };
                        return (
                          <span key={pref} className={`px-5 py-2.5 ${colors[pref] || 'bg-surface-container-low'} ${colors[pref] ? 'text-white' : 'text-on-surface-variant'} rounded-full text-sm font-bold flex items-center gap-2`}>
                            <span className="material-symbols-outlined text-base">{icons[pref] || 'label'}</span>
                            {pref.charAt(0).toUpperCase() + pref.slice(1)}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container-low mb-4">
                        <span className="material-symbols-outlined text-3xl text-outline">style</span>
                      </div>
                      <p className="text-on-surface-variant font-medium mb-2">No travel preferences set</p>
                      <p className="text-xs text-outline">Add your travel preferences to help others understand your style</p>
                    </div>
                  )}
                </section>

                {/* Contact Information */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(64,89,170,0.04)]">
                  <h3 className="text-lg font-bold text-primary mb-6">{t('Contact Information')}</h3>
                  <div className="space-y-4">
                    {profile?.email && (
                      <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl">
                        <span className="material-symbols-outlined text-primary">mail</span>
                        <div>
                          <p className="text-xs text-outline font-bold uppercase">Email</p>
                          <p className="text-sm font-bold text-on-surface">{profile.email}</p>
                        </div>
                      </div>
                    )}
                    {profile?.phoneNo && (
                      <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl">
                        <span className="material-symbols-outlined text-primary">call</span>
                        <div>
                          <p className="text-xs text-outline font-bold uppercase">Phone</p>
                          <p className="text-sm font-bold text-on-surface">{profile.phoneNo}</p>
                        </div>
                      </div>
                    )}
                    {(!profile?.email && !profile?.phoneNo) && (
                      <div className="text-center py-6">
                        <p className="text-sm text-outline">No contact information available</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Privacy & Control */}
                <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(64,89,170,0.04)]">
                  <h3 className="text-lg font-bold text-primary mb-6">{t('Privacy & Visibility')}</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between group">
                      <div>
                        <h4 className="font-bold text-on-surface">{t('Show exact location to connections')}</h4>
                        <p className="text-sm text-on-surface-variant">{t('Only approved travel buddies can see your current city.')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={privacySettings.showLocation} onChange={(e) => savePrivacySettings({ ...privacySettings, showLocation: e.target.checked })} className="sr-only peer" />
                        <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between group">
                      <div>
                        <h4 className="font-bold text-on-surface">{t('Public Reviews')}</h4>
                        <p className="text-sm text-on-surface-variant">{t('Allow anyone to read the testimonials left by previous hosts.')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={privacySettings.publicReviews} onChange={(e) => savePrivacySettings({ ...privacySettings, publicReviews: e.target.checked })} className="sr-only peer" />
                        <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between group">
                      <div>
                        <h4 className="font-bold text-on-surface">{t('Stealth Mode')}</h4>
                        <p className="text-sm text-on-surface-variant">{t("Hide your profile from 'Discovery' searches while traveling.")}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={privacySettings.stealthMode} onChange={(e) => savePrivacySettings({ ...privacySettings, stealthMode: e.target.checked })} className="sr-only peer" />
                        <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                      </label>
                    </div>

                  </div>
                </section>
              </div>
            </div>
          </div>
          </>
          ) : activeTab === 'web' ? (
          <div className="max-w-4xl mx-auto px-6 pt-12 pb-32 animate-fade-in">
            <h2 className="text-3xl font-extrabold text-primary mb-8 tracking-tight">{t('Web Settings')}</h2>
            
            <div className="space-y-8">
              {/* Language Selection */}
              <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(64,89,170,0.04)]">
                <h3 className="text-lg font-bold text-primary mb-6">{t('Language & Region')}</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-on-surface">{t('Display Language')}</h4>
                    <p className="text-sm text-on-surface-variant">{t('Select your preferred language for the interface.')}</p>
                  </div>
                  <select 
                    value={webSettings.language}
                    onChange={(e) => saveWebSettings({ ...webSettings, language: e.target.value })}
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2 font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                  >
                    <option value="en">English (US)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="jp">日本語</option>
                  </select>
                </div>
              </section>

              {/* Display & Appearance */}
              <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(64,89,170,0.04)]">
                <h3 className="text-lg font-bold text-primary mb-6">{t('Display & Appearance')}</h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-on-surface">{t('Font Size')}</h4>
                      <p className="text-sm text-on-surface-variant">{t('Adjust the text size for better readability.')}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-xl">
                      {['small', 'medium', 'large'].map(size => (
                        <button
                          key={size}
                          onClick={() => saveWebSettings({ ...webSettings, fontSize: size })}
                          className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all ${webSettings.fontSize === size ? 'bg-white shadow-sm text-primary' : 'text-outline hover:text-on-surface'}`}
                        >
                          {t(size)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-outline-variant/10">
                    <div>
                      <h4 className="font-bold text-on-surface">{t('Compact View')}</h4>
                      <p className="text-sm text-on-surface-variant">{t('Reduce spacing to fit more content on screen.')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={webSettings.compactView} onChange={(e) => saveWebSettings({ ...webSettings, compactView: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                    </label>
                  </div>
                </div>
              </section>

              {/* Notifications */}
              <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_10px_40px_rgba(64,89,170,0.04)]">
                <h3 className="text-lg font-bold text-primary mb-6">{t('Alerts & Sounds')}</h3>
                
                <div className="space-y-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-on-surface flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg">{webSettings.muteNotifications ? 'notifications_off' : 'notifications_active'}</span>
                          {t('Mute Notifications')}
                        </h4>
                        <p className="text-sm text-on-surface-variant">{t('Temporarily disable all notification sounds and popups.')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={webSettings.muteNotifications} onChange={(e) => {
                          const isMuted = e.target.checked;
                          saveWebSettings({ ...webSettings, muteNotifications: isMuted, muteUntil: isMuted ? webSettings.muteUntil : null });
                        }} className="sr-only peer" />
                        <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-error"></div>
                      </label>
                    </div>

                    {webSettings.muteNotifications && (
                      <div className="flex items-center gap-3 pl-8 pt-2">
                        <span className="text-sm font-bold text-on-surface-variant">Mute duration:</span>
                        <select
                          className="bg-surface-container-low border-none rounded-xl px-3 py-1.5 text-sm font-bold text-on-surface focus:ring-2 focus:ring-error outline-none cursor-pointer"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'indefinite') {
                              saveWebSettings({ ...webSettings, muteUntil: null });
                            } else {
                              const date = new Date();
                              date.setHours(date.getHours() + parseInt(val));
                              saveWebSettings({ ...webSettings, muteUntil: date });
                            }
                          }}
                        >
                          <option value="indefinite">Until I turn it back on</option>
                          <option value="1">For 1 hour</option>
                          <option value="8">For 8 hours</option>
                          <option value="24">For 24 hours</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
            
            {savingSettings && (
              <div className="fixed bottom-6 right-6 bg-secondary text-white px-6 py-3 rounded-full shadow-lg font-bold text-sm animate-pulse flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">sync</span> Saving settings...
              </div>
            )}
          </div>
          ) : null}
        </main>
        </div>
      )}

      {/* ── Edit Profile Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-gray-900">Edit Profile</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-700 text-3xl leading-none">×</button>
              </div>

              <form onSubmit={handleSave} className="space-y-5">

                {/* Image uploads row */}
                <div className="flex gap-6 items-start pb-5 border-b border-gray-100">
                  {/* Avatar upload */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24 rounded-full bg-accent text-accent-text flex items-center justify-center font-black text-3xl overflow-hidden border-2 border-gray-200">
                      {avatarPreview || profile?.profileIconUrl ? (
                        <img src={avatarPreview || profile.profileIconUrl} alt="avatar" className="w-full h-full object-cover" />
                      ) : initial}
                    </div>
                    <button
                      type="button"
                      onClick={() => editAvatarRef.current?.click()}
                      className="text-xs font-bold text-accent hover:underline"
                    >
                      Change Photo
                    </button>
                    <p className="text-xs text-gray-400">Max {MAX_AVATAR_MB}MB</p>
                    {errors.avatar && <p className="text-xs text-red-500 text-center">{errors.avatar}</p>}
                    <input ref={editAvatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </div>

                  {/* Cover upload */}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-700 mb-1">Cover Image <span className="text-xs font-normal text-gray-400">Max {MAX_COVER_MB}MB</span></p>
                    <div
                      className="w-full h-28 rounded-xl overflow-hidden bg-gradient-to-br from-secondary to-accent cursor-pointer relative group"
                      onClick={() => editCoverRef.current?.click()}
                    >
                      {(coverPreview || profile?.coverImageUrl) && (
                        <img src={coverPreview || profile.coverImageUrl} alt="cover" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-bold">Click to change</span>
                      </div>
                    </div>
                    {errors.cover && <p className="text-xs text-red-500 mt-1">{errors.cover}</p>}
                    <input ref={editCoverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                  </div>
                </div>

                {/* Two-column fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Nickname</label>
                    <input
                      type="text"
                      value={editForm.nickname}
                      onChange={e => setEditForm(p => ({ ...p, nickname: e.target.value }))}
                      placeholder="Your display name"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Username</label>
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={e => setEditForm(p => ({ ...p, username: e.target.value }))}
                      placeholder="@username"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      disabled
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={editForm.phoneNo}
                      disabled
                      placeholder="+1 234 567 8900"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Travel Philosophy</label>
                  <textarea
                    value={editForm.travelPhilosophy}
                    onChange={e => setEditForm(p => ({ ...p, travelPhilosophy: e.target.value }))}
                    rows={4}
                    placeholder="Share your travel philosophy to connect with like-minded travelers..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-8 py-2.5 bg-secondary text-secondary-text font-black rounded-xl hover:bg-secondary-dark transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* ── Linked Accounts Modal ── */}
      {showLinkedModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Social Verifications</h2>
              <button onClick={() => setShowLinkedModal(false)} className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* ── Already verified section ── */}
            {autoVerifiedAccounts.length > 0 && (
              <>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Already Verified</p>
                <div className="space-y-2 mb-6">
                  {autoVerifiedAccounts.map((account) => (
                    <div key={account.platform} className="flex items-center justify-between p-4 border-2 border-emerald-100 bg-emerald-50 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${account.color} text-white flex items-center justify-center rounded-xl shadow-sm`}>
                          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{account.icon}</span>
                        </div>
                        <div>
                          <span className="font-bold text-gray-800 block">{account.platform}</span>
                          <span className="text-xs text-gray-500 truncate max-w-[180px] block">{account.handle}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wide">Verified</span>
                        <span className="material-symbols-outlined text-emerald-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Connect more section ── */}
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Connect More Accounts</p>
            <p className="text-gray-500 text-sm mb-4">Link your social platforms to boost your trust score.</p>
            <div className="space-y-3">
              {linkedAccountPlatforms.map(platform => {
                const LIMITS = { Gmail: 5, GitHub: 1, LinkedIn: 1, Discord: 1 };
                const linked = (profile?.linkedAccounts || []).filter(a => a.platform === platform.name);
                const limit  = LIMITS[platform.name] ?? 1;
                const isLinked   = platform.name !== 'Gmail' && linked.length >= limit;
                const atLimit    = linked.length >= limit;
                const countLabel = platform.name === 'Gmail' && linked.length > 0
                  ? `${linked.length}/${limit} linked`
                  : null;

                const handleClick = async () => {
                  if (atLimit) return;
                  if (platform.name === 'Gmail') {
                    setShowLinkedModal(false);
                    linkGmail();
                  } else if (platform.name === 'GitHub') {
                    setShowLinkedModal(false);
                    linkGitHub();
                  } else if (platform.name === 'LinkedIn') {
                    setShowLinkedModal(false);
                    linkLinkedIn();
                  } else if (platform.name === 'Discord') {
                    setShowLinkedModal(false);
                    linkDiscord();
                  } else {
                    await saveLinkedAccount(platform);
                  }
                };

                return (
                  <button
                    key={platform.name}
                    onClick={handleClick}
                    disabled={atLimit}
                    className={`w-full flex items-center justify-between p-4 border-2 rounded-2xl transition-all group ${
                      atLimit
                        ? 'border-green-200 bg-green-50 cursor-default'
                        : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 ${platform.bgColor || 'bg-gray-500'} flex items-center justify-center rounded-xl shadow-sm overflow-hidden`}>
                        {platform.svgGoogle ? (
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                        ) : platform.svgGitHub ? (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                          </svg>
                        ) : platform.svgLinkedIn ? (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        ) : platform.svgDiscord ? (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                          </svg>
                        ) : (
                          <span className="text-white text-lg">{platform.icon}</span>
                        )}
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-gray-800 block">{platform.name}</span>
                        {platform.name === 'Gmail' ? (
                          <span className="text-xs text-blue-500 font-semibold">
                            {countLabel || 'Verify via Google OAuth'}
                          </span>
                        ) : platform.name === 'GitHub' ? (
                          <span className="text-xs text-blue-500 font-semibold">
                            {atLimit ? 'Connected' : 'Verify via GitHub OAuth'}
                          </span>
                        ) : platform.name === 'LinkedIn' ? (
                          <span className="text-xs text-blue-500 font-semibold">
                            {atLimit ? 'Connected' : 'Verify via LinkedIn OAuth'}
                          </span>
                        ) : platform.name === 'Discord' ? (
                          <span className="text-xs text-indigo-500 font-semibold">
                            {atLimit ? 'Connected' : 'Verify via Discord OAuth'}
                          </span>
                        ) : atLimit ? (
                          <span className="text-xs text-emerald-600 font-semibold">Connected</span>
                        ) : null}
                      </div>
                    </div>
                    {atLimit ? (
                      <span className="material-symbols-outlined text-green-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">add_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
