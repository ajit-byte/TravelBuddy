import { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon issue in React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 13, { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function ViewTripPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const { user, profile } = useContext(AuthContext);
  const { showToast } = useToast();
  
  const [itinerary, setItinerary] = useState(location.state?.itinerary || null);
  const [loading, setLoading] = useState(!itinerary);

  // Check if current user is the owner
  const isOwner = itinerary && user && (itinerary.user?._id === user.id || itinerary.user === user.id);
  const isMember = itinerary?.members?.includes(profile?.username) || itinerary?.members?.includes(user?.username);

  const [mapCenter, setMapCenter] = useState([27.7172, 85.3240]); // Default
  const [markerPos, setMarkerPos] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [joinRequestCount, setJoinRequestCount] = useState(0);
  const [hasRequested, setHasRequested] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState([]); // { username, nickname, profileIconUrl }

  // Fetch itinerary if missing from state
  useEffect(() => {
    if (itinerary) return;
    const fetchItinerary = async () => {
      try {
        const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${id}`, {
          headers: { 'x-auth-token': token || '' }
        });
        if (res.ok) {
          const data = await res.json();
          setItinerary(data);
        }
      } catch (err) {
        console.error('Error fetching itinerary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItinerary();
  }, [id, itinerary]);

  // Fetch join request count & user request status
  useEffect(() => {
    if (!itinerary?._id) return;
    const fetchMeta = async () => {
      try {
        const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
        const [countRes, statusRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${itinerary._id}/join-requests/count`, {
            headers: { 'x-auth-token': token || '' }
          }),
          fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${itinerary._id}/join-request-status`, {
            headers: { 'x-auth-token': token || '' }
          })
        ]);
        if (countRes.ok) {
          const { count } = await countRes.json();
          setJoinRequestCount(count);
        }
        if (statusRes.ok) {
          const { requested } = await statusRes.json();
          setHasRequested(requested);
          if (requested && itinerary?.tripPacts) {
            setIsSigned(true);
            setAgreedPacts(itinerary.tripPacts.map((_, idx) => idx));
          } else {
            setIsSigned(false);
            setAgreedPacts([]);
          }
        }
      } catch (err) { console.error(err); }
    };
    fetchMeta();
  }, [itinerary]);

  // Fetch member profile photos when itinerary members change
  useEffect(() => {
    if (!itinerary?.members?.length) { setMemberProfiles([]); return; }
    const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
    fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${itinerary._id}/member-profiles`, {
      headers: { 'x-auth-token': token || '' },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setMemberProfiles(data))
      .catch(() => setMemberProfiles([]));
  }, [itinerary?._id, itinerary?.members?.length]);

  // Pact agreement state — track indices of agreed rules
  const [agreedPacts, setAgreedPacts] = useState([]);

  const isPactComplete = itinerary?.tripPacts?.length > 0 
    ? agreedPacts.length === itinerary.tripPacts.length 
    : true;

  // Geocode destination on mount
  useEffect(() => {
    const destToSearch = itinerary?.destinations?.[0] || itinerary?.destination;
    if (destToSearch) {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destToSearch)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            const newPos = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            setMapCenter(newPos);
            setMarkerPos(newPos);
          }
        })
        .catch(err => console.error('Geocoding error:', err));
    }
  }, [itinerary]);

  // Fetch save status on mount
  useEffect(() => {
    const checkSaveStatus = async () => {
      const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
      if (!token || !itinerary?._id) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${itinerary._id}/save`, {
          headers: { 'x-auth-token': token }
        });
        if (res.ok) {
          const data = await res.json();
          setIsSaved(data.saved);
        }
      } catch (err) {
        console.error('Error checking save status:', err);
      }
    };
    checkSaveStatus();
  }, [itinerary?._id]);

  const handleToggleSave = async () => {
    const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
    if (!token || !itinerary?._id) return;
    
    setSaveLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${itinerary._id}/save`, {
        method: 'POST',
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setIsSaved(data.saved);
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleJoinRequest = async () => {
    const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
    if (!token || !itinerary?._id) return navigate('/login');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${itinerary._id}/join-request`, {
        method: 'POST',
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Join request sent successfully!', 'success');
        setJoinRequestCount(prev => prev + 1);
        setHasRequested(true);
      } else {
        showToast(data.msg || 'Failed to send request', 'error');
      }
    } catch (err) {
      console.error('Error sending join request:', err);
    }
  };

  const handleLeavePlan = async () => {
    if (!window.confirm("Are you sure you want to leave this trip plan?")) return;
    const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
    if (!token || !itinerary?._id) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/${itinerary._id}/leave`, {
        method: 'POST',
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        alert('You have left the trip plan.');
        setItinerary(prev => ({
          ...prev,
          members: prev.members.filter(m => m !== data.username)
        }));
        setHasRequested(false);
      } else {
        const data = await res.json();
        alert(data.msg || 'Failed to leave plan');
      }
    } catch (err) {
      console.error('Error leaving plan:', err);
    }
  };

  // Derive dynamic properties if itinerary exists
  const title = itinerary?.title || itinerary?.destination || 'Trip Schedule';
  const fullDest = itinerary?.destinations?.join(', ') || itinerary?.destination || '';
  const dest = fullDest.split(/[&,]/)[0].trim() || 'Multple Destinations';
  
  let dateText = 'Dates TBD';
  if (itinerary?.startDate && itinerary?.endDate) {
    const s = new Date(itinerary.startDate);
    const e = new Date(itinerary.endDate);
    dateText = `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'})}`;
  }

  const budget = itinerary?.budget || 0;
  
  // Categorized budgets based on exactly what's in CreateItinerary
  const getBudgetFor = (type) => (itinerary?.activityItems || []).filter(a => a.budgetType === type).reduce((s, a) => s + (Number(a.cost) || 0), 0);
  
  const foodBudget = getBudgetFor('Food');
  const tourBudget = getBudgetFor('Tour');
  const stayBudget = getBudgetFor('Stay'); // Maps to "Accommodation" in UI if desired
  const travelBudget = getBudgetFor('Travel Fee'); // Maps to "Transport" in UI if desired
  const shoppingBudget = getBudgetFor('Shopping');
  const entBudget = getBudgetFor('Entertainment');
  
  const sumKnown = foodBudget + tourBudget + stayBudget + travelBudget + shoppingBudget + entBudget;
  const otherBudget = Math.max(0, budget - sumKnown);

  // Group activities by day
  const daysMap = {};
  (itinerary?.activityItems || []).forEach(act => {
    if (!daysMap[act.dayId]) daysMap[act.dayId] = [];
    daysMap[act.dayId].push(act);
  });
  const sortedDays = Object.keys(daysMap).sort((a,b) => Number(a) - Number(b));

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  if (!itinerary) return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
       <span className="material-symbols-outlined text-6xl text-outline/20 mb-4">map</span>
       <h2 className="text-2xl font-bold text-primary">Itinerary not found</h2>
       <button onClick={() => navigate('/itineraryplanningpage')} className="mt-4 text-primary font-bold">Return to Search</button>
    </div>
  );

  // Calculate percentages for the chart
  const bT = Math.max(1, budget);
  const pFood = (foodBudget / bT) * 100;
  const pTour = (tourBudget / bT) * 100;
  const pStay = (stayBudget / bT) * 100;
  const pTrav = (travelBudget / bT) * 100;
  const pShop = (shoppingBudget / bT) * 100;
  const pEnt  = (entBudget / bT) * 100;
  const pOth  = Math.max(0, 100 - (pFood + pTour + pStay + pTrav + pShop + pEnt));

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-32">
      
      {/* Global Navbar */}
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>

      <main className="max-w-screen-2xl mx-auto px-6 py-8 pt-24 grid grid-cols-12 gap-8">
        
        {/* Left Column: Itinerary & Map */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          {/* Header Section - Final Version */}
          <div className="flex flex-col gap-4 mb-4">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors w-fit group outline-none">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span className="text-sm font-semibold">Go back</span>
            </button>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <h1 className="text-4xl font-extrabold font-headline text-primary tracking-tight">{title}</h1>
                <p className="text-on-surface-variant mt-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">calendar_today</span> {dateText}
                  <span className="mx-2">•</span>
                  <span className="material-symbols-outlined text-sm">location_on</span> {dest}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleToggleSave}
                  disabled={saveLoading}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full cursor-pointer transition-all shadow-sm outline-none border ${isSaved ? 'bg-primary border-primary text-white' : 'bg-white border-outline-variant/30 text-primary/70 hover:bg-slate-50'}`}
                >
                  <span className={`material-symbols-outlined text-xl ${isSaved ? 'text-white' : 'text-primary'}`} style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "" }}>bookmark</span>
                  <span className="text-sm font-semibold">{isSaved ? 'Saved' : 'Save itinerary'}</span>
                </button>
                {!isOwner && !isMember && (
                  <button 
                    onClick={handleJoinRequest} 
                    disabled={hasRequested || !isSigned}
                    className={`bg-gradient-to-br ${hasRequested ? 'from-slate-400 to-slate-500' : (!isSigned ? 'from-slate-200 to-slate-300' : 'from-orange-400 to-orange-500')} text-white font-bold px-8 py-3 rounded-full shadow-lg shadow-orange-500/20 flex items-center gap-2 hover:scale-105 transition-transform outline-none cursor-pointer disabled:cursor-default`}
                  >
                    <span className="material-symbols-outlined">{hasRequested ? 'pending_actions' : 'person_add'}</span>
                    {hasRequested ? 'Request Sent' : (!isSigned ? 'Accept trip pacts' : 'Join Request')}
                  </button>
                )}
                {!isOwner && isMember && (
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 text-white font-bold px-6 py-3 rounded-full shadow-md flex items-center gap-2 cursor-default">
                      <span className="material-symbols-outlined">how_to_reg</span>
                      Member
                    </div>
                    <button 
                      onClick={handleLeavePlan}
                      className="bg-white border border-red-200 text-red-500 hover:bg-red-50 font-bold px-6 py-3 rounded-full shadow-sm flex items-center gap-2 transition-all outline-none"
                    >
                      <span className="material-symbols-outlined">logout</span>
                      Leave plan
                    </button>
                  </div>
                )}
                {isOwner && (
                  <button onClick={() => navigate('/edit-itinerary', { state: { itinerary } })} className="w-12 h-12 bg-surface-container-high rounded-full hover:bg-surface-dim transition-colors flex items-center justify-center outline-none" title="Edit Plan">
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bento Grid - Map & Side Columns - Final Version */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Interactive Map Container */}
            <div className="md:col-span-2 relative h-[450px] bg-surface-container rounded-3xl overflow-hidden group shadow-inner">
              <MapContainer 
                center={mapCenter} 
                zoom={13} 
                className="w-full h-full z-0" 
                zoomControl={false}
              >
                <TileLayer
                  url="https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=1ayBaS3Kqy7c6TCGvZYN"
                  attribution='&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>'
                />
                <MapUpdater center={mapCenter} />
                {markerPos && <Marker position={markerPos} />}
              </MapContainer>
              
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none z-10 transition-opacity group-hover:opacity-60"></div>
              
              <div className="absolute bottom-6 left-6 bg-surface-container-lowest/90 backdrop-blur-md p-4 rounded-2xl shadow-xl z-20 border border-white/20">
                <p className="font-bold text-primary font-headline">Destination Point</p>
                <p className="text-sm text-on-surface-variant">{dest}</p>
              </div>
              
            </div>

            {/* Three Stacked Containers - Final Version */}
            <div className="space-y-4">
              {/* Travel Type Container */}
              <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/15 flex flex-col gap-4 shadow-sm">
                <h3 className="text-lg font-bold font-headline text-primary">Travel Type</h3>
                <div className="flex flex-wrap gap-2">
                  {(itinerary?.tags || []).length > 0 ? (
                    itinerary.tags.map((tag, i) => (
                      <span key={i} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${
                        i % 3 === 0 ? 'bg-primary-fixed text-primary' :
                        i % 3 === 1 ? 'bg-secondary-fixed text-secondary' :
                        'bg-tertiary-fixed text-tertiary'
                      }`}>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-outline italic">No tags specified</p>
                  )}
                </div>
              </div>

              {/* Ready to Join Container */}
              <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/15 flex items-center justify-center min-h-[100px] shadow-sm">
                <div className="text-center">
                  <p className="text-2xl font-black text-primary">{joinRequestCount}</p>
                  <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">Interested People</p>
                </div>
              </div>

              {/* Users Joined Container */}
              <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/15 flex flex-col gap-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                      {/* Owner first */}
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-primary text-[10px] font-bold text-white flex items-center justify-center ring-1 ring-primary/20 z-10 overflow-hidden" title={itinerary?.user?.nickname || itinerary?.user?.username || 'Owner'}>
                        {itinerary?.user?.profileIconUrl
                          ? <img src={itinerary.user.profileIconUrl} alt="owner" className="w-full h-full object-cover" />
                          : String(itinerary?.user?.nickname?.[0] || itinerary?.user?.username?.[0] || 'O').toUpperCase()
                        }
                      </div>
                      {/* Members next — with real profile photos */}
                      {(itinerary?.members || []).slice(0, 2).map((m, i) => {
                        const mp = memberProfiles.find(p => p.username === m);
                        return (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary ring-1 ring-primary/20 overflow-hidden" title={mp?.nickname || m}>
                            {mp?.profileIconUrl
                              ? <img src={mp.profileIconUrl} alt={m} className="w-full h-full object-cover" />
                              : String(m?.[0] || 'U').toUpperCase()
                            }
                          </div>
                        );
                      })}
                  </div>
                  {(itinerary?.members?.length || 0) > 2 && (
                    <div className="w-8 h-8 rounded-full border border-outline-variant/30 flex items-center justify-center text-[10px] font-bold text-slate-400 bg-surface-container-low">
                      +{(itinerary.members.length) - 2}
                    </div>
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-on-surface">Members in this plan</p>
                    <p className="text-[10px] text-on-surface-variant">{(itinerary?.members?.length || 0) + 1} Total Travelers</p>
                  </div>
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 transition-colors"
                  >
                    View members
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Itinerary View */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold font-headline text-primary">Daily Itinerary</h2>
              <div className="flex gap-2">
                <button className="p-2 bg-surface-container-low rounded-xl text-primary hover:bg-surface-container-high transition-colors outline-none"><span className="material-symbols-outlined">chevron_left</span></button>
                <button className="p-2 bg-surface-container-low rounded-xl text-primary hover:bg-surface-container-high transition-colors outline-none"><span className="material-symbols-outlined">chevron_right</span></button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedDays.length > 0 ? (
                sortedDays.map(dayId => {
                  const acts = daysMap[dayId];
                  const dDate = acts[0]?.date ? new Date(acts[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric'}) : `Day ${dayId}`;
                  return (
                    <div key={dayId} className="bg-surface-container-lowest p-6 rounded-3xl border-l-[6px] border-primary hover:shadow-xl transition-all group shadow-sm flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Day {dayId} • {dDate}</p>
                          <h4 className="font-bold text-lg text-on-surface">Schedule Plans</h4>
                        </div>
                        <span className="material-symbols-outlined text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity">event_note</span>
                      </div>
                      <div className="space-y-4 flex-grow">
                        {acts.map((act, ai) => (
                          <div key={ai} onClick={() => {
                            if (act.location) {
                              fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(act.location)}`)
                                .then(res => res.json())
                                .then(data => {
                                  if (data && data.length > 0) {
                                    const newPos = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                                    setMapCenter(newPos);
                                    setMarkerPos(newPos);
                                  }
                                }).catch(console.error);
                            }
                          }} className="flex flex-col gap-2 p-4 bg-surface-container-low rounded-2xl border border-transparent hover:border-primary/5 transition-all cursor-pointer">
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-secondary">{
                                act.budgetType === 'Transport' ? 'directions_car' :
                                act.budgetType === 'Food' ? 'restaurant' :
                                act.budgetType === 'Accommodation' ? 'hotel' :
                                act.budgetType === 'Entertainment' ? 'movie' : 'local_activity'
                              }</span>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-on-surface leading-tight">{act.name}</p>
                                <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{act.time || 'All day'} • {act.location || 'See map'}</p>
                              </div>
                            </div>
                            {act.description && (
                              <p className="text-sm text-on-surface-variant/80 border-t border-surface-container pt-2 mt-1 leading-relaxed">{act.description}</p>
                            )}
                            {act.note && (
                              <p className="text-sm italic text-primary/60 mt-1 flex items-center gap-1.5 bg-primary/5 p-2 rounded-lg">
                                <span className="material-symbols-outlined text-sm">notes</span>
                                {act.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="md:col-span-2 p-12 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30 text-center">
                  <p className="text-outline font-bold italic">No specific activities scheduled yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Trip Pact & Budget */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Trip Pact Contract - Final Version with Security Score */}
          <div className="bg-primary text-on-primary p-8 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col min-h-[500px]">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-on-primary/10 rounded-full blur-3xl"></div>
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-tertiary-fixed">verified_user</span>
                <h3 className="text-xl font-bold font-headline">The Trip Pact</h3>
              </div>
              <p className="text-blue-200 text-sm mb-6 leading-relaxed">By joining, you agree to these community-set rules for a safe solo-travel experience.</p>
              
              <div className="space-y-4">
                {(itinerary?.tripPacts || []).length > 0 ? (
                  itinerary.tripPacts.map((pact, idx) => (
                    <label key={idx} className="flex items-start gap-4 cursor-pointer group">
                      <input 
                        checked={agreedPacts.includes(idx)}
                        onChange={(e) => {
                          if (e.target.checked) setAgreedPacts(prev => [...prev, idx]);
                          else setAgreedPacts(prev => prev.filter(i => i !== idx));
                        }}
                        className="mt-1 w-5 h-5 shrink-0 rounded border-2 border-white/30 text-tertiary bg-white/10 focus:ring-0 cursor-pointer checked:bg-tertiary-fixed checked:border-tertiary-fixed transition-colors" 
                        type="checkbox"
                      />
                      <div className="text-sm">
                        <span className="font-bold block text-base mb-1">Pact Rule #{idx + 1}</span>
                        <span className="text-blue-300 text-xs text-wrap leading-relaxed">{pact}</span>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-blue-200 italic">No specific pact rules defined for this trip.</p>
                )}
              </div>
            </div>

            {/* Pact Security & Signature Section */}
            <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold mb-2">Pact Security</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-tertiary-fixed/30 bg-white/5 shadow-inner">
                      <span className="text-[10px] font-bold text-tertiary-fixed">94%</span>
                    </div>
                    <span className="text-xs font-medium">Safe Zone Activity</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-tighter text-blue-200 block mb-1">E-Signature</span>
                  <span className="material-symbols-outlined text-sm text-tertiary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>draw</span>
                </div>
              </div>
              <button 
                disabled={!isPactComplete || isSigned}
                className={`w-full h-16 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-inner outline-none ${
                    isSigned 
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20 shadow-lg' 
                        : (isPactComplete 
                            ? 'bg-tertiary-fixed text-primary border-tertiary-fixed cursor-pointer hover:scale-[1.02] shadow-lg active:scale-95' 
                            : 'bg-white/5 border-white/10 italic text-blue-300 opacity-50 cursor-not-allowed')
                }`}
                onClick={() => setIsSigned(true)}
              >
                {isSigned ? (
                    <>
                        <span className="material-symbols-outlined font-bold">check_circle</span>
                        Pact Signed
                    </>
                ) : 'Click to sign pact'}
              </button>
            </div>
          </div>

          {/* Budget Splitter Container - Final Version */}
          <div className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-surface-container">
            <h3 className="text-xl font-bold font-headline text-primary mb-8 text-center">Budget Splitter</h3>
            <div className="flex flex-col items-center gap-8">
              <div className="relative w-56 h-56">
                <svg className="w-full h-full -rotate-90 drop-shadow-md" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="transparent" r="15.9155" stroke="#f2f4f6" strokeWidth="3"></circle>
                  
                  {/* Food - Amber */}
                  <circle cx="18" cy="18" fill="transparent" r="15.9155" stroke="#fbbf24" strokeDasharray={`${pFood} 100`} strokeWidth="4"></circle>
                  
                  {/* Tour - Blue */}
                  <circle cx="18" cy="18" fill="transparent" r="15.9155" stroke="#3b82f6" strokeDasharray={`${pTour} 100`} strokeDashoffset={-pFood} strokeWidth="4"></circle>
                  
                  {/* Stay - Indigo */}
                  <circle cx="18" cy="18" fill="transparent" r="15.9155" stroke="#6366f1" strokeDasharray={`${pStay} 100`} strokeDashoffset={-(pFood + pTour)} strokeWidth="4"></circle>
                  
                  {/* Travel Fee - Emerald */}
                  <circle cx="18" cy="18" fill="transparent" r="15.9155" stroke="#10b981" strokeDasharray={`${pTrav} 100`} strokeDashoffset={-(pFood + pTour + pStay)} strokeWidth="4"></circle>
                  
                  {/* Shopping - Rose */}
                  <circle cx="18" cy="18" fill="transparent" r="15.9155" stroke="#fb7185" strokeDasharray={`${pShop} 100`} strokeDashoffset={-(pFood + pTour + pStay + pTrav)} strokeWidth="4"></circle>
                  
                  {/* Entertainment - Purple */}
                  <circle cx="18" cy="18" fill="transparent" r="15.9155" stroke="#a855f7" strokeDasharray={`${pEnt} 100`} strokeDashoffset={-(pFood + pTour + pStay + pTrav + pShop)} strokeWidth="4"></circle>

                  {/* Others - Grayish */}
                  <circle cx="18" cy="18" fill="transparent" r="15.9155" stroke="#cbd5e1" strokeDasharray={`${pOth} 100`} strokeDashoffset={-(pFood + pTour + pStay + pTrav + pShop + pEnt)} strokeWidth="4"></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter mb-1">Total Est.</p>
                  <p className="text-3xl font-black text-primary">${budget.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="w-full space-y-4">
                {[
                  { label: 'Food', amount: foodBudget, color: '#fbbf24' },
                  { label: 'Tour', amount: tourBudget, color: '#3b82f6' },
                  { label: 'Stay', amount: stayBudget, color: '#6366f1' },
                  { label: 'Travel Fee', amount: travelBudget, color: '#10b981' },
                  { label: 'Shopping', amount: shoppingBudget, color: '#fb7185' },
                  { label: 'Entertainment', amount: entBudget, color: '#a855f7' },
                  { label: 'Others', amount: otherBudget, color: '#cbd5e1' },
                ].filter(item => item.amount > 0).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-surface-container-low/50 p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm font-medium text-on-surface-variant">{item.label}</span>
                    </div>
                    <span className="font-bold text-on-surface">${item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMembersModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-primary font-headline">Trip Members</h3>
              <button onClick={() => setShowMembersModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              <div
                className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => { setShowMembersModal(false); navigate(`/profile/${itinerary.user?._id}`); }}
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                  {itinerary.user?.profileIconUrl
                    ? <img src={itinerary.user.profileIconUrl} alt="" className="w-full h-full object-cover" />
                    : String(itinerary.user?.nickname?.[0] || itinerary.user?.username?.[0] || 'O').toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-on-surface truncate">{itinerary.user?.nickname || itinerary.user?.username || 'Owner'}</p>
                  <p className="text-[10px] text-outline font-medium">@{itinerary.user?.username}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-primary/10 text-primary rounded-full shrink-0">Host</span>
              </div>
              {(itinerary?.members || []).length === 0 ? (
                <div className="px-6 py-8 text-center text-outline text-sm italic">No members have joined yet.</div>
              ) : (
                itinerary.members.map((username, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {String(username?.[0] || 'U').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-on-surface truncate">{username}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-secondary/10 text-secondary rounded-full shrink-0">Member</span>
                  </div>
                ))
              )}
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-xs text-outline font-medium">
                {(itinerary?.members?.length || 0) + 1} total traveler{(itinerary?.members?.length || 0) + 1 !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
