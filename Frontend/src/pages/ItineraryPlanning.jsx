import { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { useWebSettings } from '../context/WebSettingsContext';

export default function ItineraryPlanning() {
  const { user, profile } = useContext(AuthContext);
  const { t } = useWebSettings();
  const navigate = useNavigate();
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draftTrigger, setDraftTrigger] = useState(0);
  
  const [activeTab, setActiveTab] = useState('My trips'); // 'My trips', 'Past Adventures', 'Draft'
  const defaultAvatar = profile?.profileIconUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCHDLSYqG_-0lJWkvkKLeOrjXM5vSpr2U21v54X4M3nmQY9HmFRm3z6btarIA3WR_ZDiVirlJg_pj70n04SrMJr9kS8JT4BZu4RJXQAWZbHFkoLFnwMLWNkaOeBr9yNPJJ3TcXSlO6L-XuXpBipriSBp7k6MNu5Hvs3vmWwzuZMmSt05U3Z6L8a3COFUuEjGRiVgDN0_Y6lEq391fKbGYLtDEb-LnloumaSQ9UgRqhscZ9XxuYM8-j4GmP-MX5-lYKyDJoFHRr_D8E-";

  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageClick = (id) => {
    setUploadingId(id);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingId) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${uploadingId}/upload-image`, {
        method: 'POST',
        headers: { 'x-auth-token': token || '' },
        body: formData,
      });

      if (res.ok) {
        const updatedItinerary = await res.json();
        setItineraries(prev => prev.map(it => it._id === uploadingId ? updatedItinerary : it));
      } else {
        alert('Failed to upload image');
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading image');
    } finally {
      setUploadingId(null);
      e.target.value = null;
    }
  };

  useEffect(() => {
    const fetchMyItineraries = async () => {
      try {
        const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
        const headers = { 'x-auth-token': token || '' };

        // Fetch both owned and joined itineraries in parallel
        const [myRes, joinedRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/my`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/joined`, { headers }),
        ]);

        const myData    = myRes.ok    ? await myRes.json()    : [];
        const joinedData = joinedRes.ok ? await joinedRes.json() : [];

        // Merge — owned first, then joined (dedup by _id just in case)
        const seen = new Set();
        const merged = [...myData, ...joinedData].filter(it => {
          if (seen.has(it._id)) return false;
          seen.add(it._id);
          return true;
        });

        setItineraries(merged);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyItineraries();
  }, []);

  const handleViewTrip = (item) => {
    navigate('/trip/' + item._id, { state: { itinerary: item } });
  };

  const handleEditTrip = (item) => {
    navigate('/edit-itinerary', { state: { itinerary: item } });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this itinerary permanently?')) return;

    try {
      const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token || '' },
      });

      if (!res.ok) throw new Error('Delete failed');

      setItineraries(prev => prev.filter(i => i._id !== id));
    } catch (err) {
      alert('Could not delete itinerary');
    }
  };

  const handleDraftDelete = () => {
     if (!window.confirm('Delete this draft permanently?')) return;
     localStorage.removeItem('draftItinerary');
     setDraftTrigger(prev => prev + 1);
  };

  // Simple filtering logic based on dates to simulate tabs
  const filteredItineraries = useMemo(() => {
    if (activeTab === 'Draft') {
       const draftRaw = localStorage.getItem('draftItinerary');
       if (draftRaw) {
          try {
              const draftData = JSON.parse(draftRaw);
              if (draftData.form && (draftData.form.title || draftData.itineraryActivities?.length > 0)) {
                  return [{
                      _id: 'local_draft',
                      title: draftData.form.title || 'Untitled Draft',
                      startDate: draftData.form.startDate,
                      endDate: draftData.form.endDate,
                      budget: draftData.form.budget || 0,
                      isDraft: true,
                  }];
              }
          } catch(e) {}
       }
       return [];
    }

    const now = new Date();
    return itineraries.filter(it => {
       const endDate = it.endDate ? new Date(it.endDate) : new Date(it.startDate);
       if (activeTab === 'Past Adventures') {
           return endDate < now;
       } else if (activeTab === 'My trips') {
           return endDate >= now;
       }
       return false;
    });
  }, [itineraries, activeTab, draftTrigger]);

  return (
    <div className="bg-background font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-24 pb-32 px-6 max-w-screen-2xl mx-auto min-h-screen">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="text-secondary font-label text-xs uppercase tracking-[0.2em] font-bold mb-2 block font-body">{t('Your Journey Registry')}</span>
            <h1 className="font-headline text-5xl md:text-6xl font-extrabold text-primary tracking-tight">{t('My Itineraries')}</h1>
          </div>
          <button onClick={() => navigate('/create-itinerary')} className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-8 py-4 rounded-full font-headline font-bold text-lg shadow-[0_10px_30px_rgba(255,185,95,0.15)] hover:bg-tertiary-fixed/90 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 w-full md:w-auto justify-center outline-none">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_location_alt</span>
            {t('Plan New Adventure')}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-10 overflow-x-auto scroolbar-hide pb-2">
            {['My trips', 'Past Adventures', 'Draft'].map(tabName => (
               <button 
                  key={tabName}
                  onClick={() => setActiveTab(tabName)}
                  className={`px-6 py-3 rounded-full font-bold whitespace-nowrap transition-all outline-none ${activeTab === tabName ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-on-surface-variant hover:bg-surface-container-high shadow-sm'}`}
               >
                  {t(tabName)}
               </button>
            ))}
        </div>

        {/* Hidden File Input for Background Image Upload */}
        <input 
          type="file" 
          accept="image/*"
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange} 
        />

        {/* Itinerary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {loading ? (
                // Skeleton loading state
                <>
                  {[1, 2].map(i => (
                     <div key={i} className="group bg-surface-container-lowest rounded-3xl overflow-hidden flex flex-col md:flex-row transition-all duration-300 h-64 animate-pulse"></div>
                  ))}
                </>
            ) : filteredItineraries.length === 0 ? (
                /* Bento Empty State Trigger */
                <div className="lg:col-span-2 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-3xl p-10 flex flex-col items-center text-center border-2 border-dashed border-outline-variant/30">
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                    </div>
                    <h3 className="font-headline text-3xl font-extrabold text-primary mb-2">Ready for your next journey?</h3>
                    <p className="text-on-surface-variant max-w-md mb-8">Your travel map is looking a little quiet. Start sketching your next adventure or browse curated solo guides.</p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button onClick={() => navigate('/browsepage')} className="px-8 py-3 bg-primary text-white rounded-full font-bold hover:shadow-xl transition-all outline-none text-sm">
                            Explore Destinations
                        </button>
                    </div>
                </div>
            ) : (
                filteredItineraries.map((itinerary, index) => {
                    const isPublic = true; // Use real field if available later
                    const startDateMatch = itinerary.startDate ? new Date(itinerary.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric'}) : '';
                    const endDateMatch = itinerary.endDate ? new Date(itinerary.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'}) : '';
                    
                    const imgUrl = itinerary.image 
                       ? (itinerary.image.startsWith('http') ? itinerary.image : `${import.meta.env.VITE_API_URL}${itinerary.image}`) 
                       : (index % 2 === 0 ? "https://lh3.googleusercontent.com/aida-public/AB6AXuAYrLxPnAbRsQspZqaW7TCUIYnQdtYtLQgt0gWWRgZ3wGd1orVwdzKo9r-3TH4SMGLvJW4viwa5OWb6dM57n_qgRe4fw3eQ5YmwHquBmFYK0Or7d1awihC-W-iifkkTrCM7lrzj0OGSJgEz7Alhg_v58mrVizLrm_NR6fUux0an3Jr3EpkEiQNjPgtepk1sIqrZ8pSMqguROkLfJZEPUllNwzYWHcpaQ_I9VVMKg0LTY-dwIg5sFuzWNI5oLFDSjCcHfONzujnj5FSC" : "https://lh3.googleusercontent.com/aida-public/AB6AXuDiZOal-iAcSwrF938-kScbn0GPcduZ1YsntUkkkxqjptEZ0Ys0KYRYpfM3NaoUiSVCMJJ_R2Byb7pfsrgguDzNLD3E_vdlJ4-8HysMUFFXh153JoalDcfZFAaqoNNq38HF2zpj1YZImSxbV7BkxzDwhrdFOM6n7gSdnj3xfeLRxpzcy6IZeAICOM7TKVpz5wR4XDe0Ke1uE2Td6dZ4SjjCn38cwmGEfwUy_BIaOa84nZvmM8PI6VQtStlvK9IiR0IoLlS6_lfLyeFJ");

                    return (
                        <div key={itinerary._id} className="group bg-surface-container-lowest rounded-3xl overflow-hidden flex flex-col md:flex-row transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10">
                            <div 
                              className="w-full md:w-2/5 relative h-48 md:h-auto overflow-hidden cursor-pointer"
                              title="Click to change background image"
                              onClick={() => !itinerary.isDraft && handleImageClick(itinerary._id)}
                            >
                                <img alt={itinerary.title} className={`w-full h-full object-cover transition-all duration-700 ${uploadingId === itinerary._id ? 'opacity-50 blur-sm scale-110' : 'group-hover:scale-110 group-hover:brightness-75'}`} src={imgUrl} />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  <span className="material-symbols-outlined text-white text-3xl drop-shadow-md">add_a_photo</span>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent pointer-events-none"></div>
                                
                                {itinerary.isDraft ? (
                                    <div className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>edit_document</span>
                                      Draft
                                    </div>
                                ) : itinerary.isJoined ? (
                                    <div className="absolute top-4 left-4 bg-teal-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
                                      Joined
                                    </div>
                                ) : isPublic ? (
                                    <div className="absolute top-4 left-4 bg-secondary-container text-on-secondary-fixed px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>public</span>
                                      Public
                                    </div>
                                ) : (
                                    <div className="absolute top-4 left-4 bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                                      Private
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-6 flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-headline text-2xl font-bold text-primary group-hover:text-secondary transition-colors line-clamp-1 pr-2">{itinerary.title}</h3>
                                        <div className="relative group/menu cursor-pointer">
                                            <button className="text-on-surface-variant hover:text-primary transition-colors outline-none shrink-0">
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </button>
                                            <div className="absolute right-0 top-6 bg-white border border-outline-variant/20 rounded-xl shadow-xl z-10 w-32 hidden group-hover/menu:block py-1 overflow-hidden">
                                                {!itinerary.isJoined && (
                                                  <button onClick={() => itinerary.isDraft ? navigate('/create-itinerary', { state: { isDraft: true } }) : handleEditTrip(itinerary)} className="w-full text-left px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-base">edit</span> Edit
                                                  </button>
                                                )}
                                                {!itinerary.isJoined && (
                                                  <button onClick={() => itinerary.isDraft ? handleDraftDelete() : handleDelete(itinerary._id)} className="w-full text-left px-4 py-2 text-sm font-bold text-error hover:bg-error-container/30 transition-colors flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-base">delete</span> Delete
                                                  </button>
                                                )}
                                                {itinerary.isJoined && (
                                                  <div className="px-4 py-2 text-xs text-outline font-medium">View only</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <p className="text-on-surface-variant text-sm flex items-center gap-2 mb-1">
                                        <span className="material-symbols-outlined text-base">calendar_today</span>
                                        {startDateMatch} {endDateMatch ? `- ${endDateMatch}` : ''}
                                    </p>
                                    
                                    <p className="text-secondary text-sm font-bold flex items-center gap-2 mb-6">
                                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                                        ${itinerary.budget ? itinerary.budget.toLocaleString() : 'N/A'}
                                    </p>
                                    
                                    <div className="flex items-center gap-2 mb-8">
                                        {(() => {
                                          const members = itinerary.members || [];
                                          const memberProfiles = itinerary.memberProfiles || [];
                                          return (
                                            <div className="flex -space-x-2 shrink-0">
                                              {/* Owner — always shown */}
                                              <div
                                                className="w-8 h-8 rounded-full border-2 border-white bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden"
                                                title={itinerary.user?.nickname || itinerary.user?.username || 'You'}
                                              >
                                                {itinerary.user?.profileIconUrl
                                                  ? <img src={itinerary.user.profileIconUrl} alt="owner" className="w-full h-full object-cover" />
                                                  : String(itinerary.user?.nickname?.[0] || itinerary.user?.username?.[0] || profile?.nickname?.[0] || profile?.username?.[0] || 'Y').toUpperCase()
                                                }
                                              </div>
                                              {/* First 2 members with real avatars */}
                                              {members.slice(0, 2).map((username, i) => {
                                                const mp = memberProfiles.find(p => p.username === username);
                                                return (
                                                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 overflow-hidden" title={mp?.nickname || username}>
                                                    {mp?.profileIconUrl
                                                      ? <img src={mp.profileIconUrl} alt={username} className="w-full h-full object-cover" />
                                                      : String(username?.[0] || 'U').toUpperCase()
                                                    }
                                                  </div>
                                                );
                                              })}
                                              {/* Overflow count */}
                                              {members.length > 2 && (
                                                <div className="w-8 h-8 rounded-full border-2 border-white bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                                  +{members.length - 2}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}
                                    </div>
                                </div>
                                
                                <div className="flex gap-2">
                                    <button onClick={() => itinerary.isDraft ? navigate('/create-itinerary', { state: { isDraft: true } }) : handleViewTrip(itinerary)} className="flex-1 bg-surface-container-low hover:bg-surface-container-high text-primary font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 outline-none">
                                        <span className="material-symbols-outlined text-base">near_me</span>
                                        {itinerary.isDraft ? 'Resume Draft' : 'Open Plan'}
                                    </button>
                                    
                                    <button className="bg-surface-container-low hover:bg-surface-container-high text-primary p-3 rounded-xl transition-all flex items-center justify-center outline-none" title="Share Trip">
                                        <span className="material-symbols-outlined text-xl">share</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>



        {/* Featured Map Section (Visual Accent) */}
        <div className="mt-20 relative rounded-3xl overflow-hidden h-[500px] border border-outline-variant/20 shadow-sm w-full">
            <img className="w-full h-full object-cover opacity-20" alt="World map texture" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6_bqb8gfOC0nwJWIy2DoFbBPHJa5iDnPTADxWxseBtvLR1u21B3OMwE-kymlA3ndrL_kp2xfBbk-d7qSMO4G6fOgN6ht9PYmx1jP7cXvJYvhT89-z3X7T4rOS1XCLE-PYb_q7JegC1U4i4rGy2R92KzJCfnuat60M0Yo9oihoNw2jqEYL84dDWK5te5IWu9ZEnXxrCMh2qqCX148tiR3GhiDCO3HtRWCy7k5nl9ldrr_1eHB8lsiw5uO9HpBoopaylhNZtt0UdW5v"/>
            <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/50"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                <div className="bg-white/80 backdrop-blur-md p-10 rounded-3xl max-w-2xl text-center shadow-2xl border border-white/50">
                    <span className="text-secondary font-bold text-xs tracking-widest uppercase mb-4 block">Travel Statistic</span>
                    <h2 className="font-headline text-4xl font-black text-primary mb-4 italic">"The world is a book and those who do not travel read only one page."</h2>
                    <p className="text-on-surface-variant font-medium">You have covered {itineraries.length} unique journey{(itineraries.length === 1) ? '' : 's'}. Keep going, explorer.</p>
                </div>
            </div>
        </div>
      </main>

    </div>
  );
}