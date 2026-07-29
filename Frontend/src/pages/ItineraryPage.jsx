import { useState, useEffect, useContext } from 'react';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getItineraries, getMyItineraries, createItinerary, updateItinerary,
  deleteItinerary, joinItinerary, leaveItinerary,
  acceptJoinRequest, declineJoinRequest, getItinerary,
} from '../api/socialApi';

function Avatar({ profile, size = 8 }) {
  const initial = (profile?.nickname || profile?.username || '?')[0].toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-full overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 text-xs`}>
      {profile?.profileIconUrl
        ? <img src={profile.profileIconUrl} alt="" className="w-full h-full object-cover" />
        : initial}
    </div>
  );
}

const EMPTY_FORM = { title: '', destination: '', description: '', startDate: '', endDate: '', budget: '', maxMembers: 5, isPublic: true, tags: '' };

export default function ItineraryPage() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();

  const [tab, setTab] = useState('explore');
  const [exploreList, setExploreList] = useState([]);
  const [myList, setMyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [explorePages, setExplorePages] = useState(1);
  const [explorePage, setExplorePage] = useState(1);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // itinerary to edit
  const [viewTarget, setViewTarget] = useState(null); // itinerary detail
  const [joinTarget, setJoinTarget] = useState(null); // itinerary to join
  const [joinMsg, setJoinMsg] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadExplore = async (p = 1, s = search) => {
    setLoading(true);
    try {
      const data = await getItineraries(p, s);
      setExploreList(p === 1 ? data.itineraries : prev => [...prev, ...data.itineraries]);
      setExplorePages(data.pages);
      setExplorePage(p);
    } catch { showToast('Failed to load itineraries', 'error'); }
    finally { setLoading(false); }
  };

  const loadMy = async () => {
    setLoading(true);
    try {
      const data = await getMyItineraries();
      setMyList(data);
    } catch { showToast('Failed to load your trips', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'explore') loadExplore(1, search);
    else loadMy();
  }, [tab]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    loadExplore(1, searchInput);
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditTarget(null); setShowCreate(true); };
  const openEdit = (it) => {
    setEditTarget(it);
    setForm({
      title: it.title, destination: it.destination, description: it.description || '',
      startDate: it.startDate ? it.startDate.slice(0, 10) : '',
      endDate: it.endDate ? it.endDate.slice(0, 10) : '',
      budget: it.budget || '', maxMembers: it.maxMembers || 5,
      isPublic: it.isPublic !== false, tags: (it.tags || []).join(', '),
    });
    setShowCreate(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.destination.trim()) {
      showToast('Title and destination are required', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        maxMembers: Number(form.maxMembers),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      if (editTarget) {
        const updated = await updateItinerary(editTarget._id, payload);
        setMyList(prev => prev.map(it => it._id === updated._id ? updated : it));
        showToast('Trip updated!', 'success');
      } else {
        const created = await createItinerary(payload);
        setMyList(prev => [created, ...prev]);
        if (tab === 'explore') setExploreList(prev => [created, ...prev]);
        showToast('Trip created!', 'success');
      }
      setShowCreate(false);
    } catch (err) { showToast(err.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteItinerary(id);
      setMyList(prev => prev.filter(it => it._id !== id));
      setExploreList(prev => prev.filter(it => it._id !== id));
      showToast('Trip deleted', 'success');
    } catch (err) { showToast(err.message || 'Delete failed', 'error'); }
  };

  const handleLeave = async (id) => {
    try {
      await leaveItinerary(id);
      setMyList(prev => prev.filter(it => it._id !== id));
      showToast('You left the trip', 'success');
    } catch (err) { showToast(err.message || 'Failed to leave', 'error'); }
  };

  const handleJoin = async () => {
    if (!joinTarget) return;
    setSaving(true);
    try {
      await joinItinerary(joinTarget._id, joinMsg);
      showToast('Join request sent!', 'success');
      setJoinTarget(null);
      setJoinMsg('');
    } catch (err) { showToast(err.message || 'Failed to send request', 'error'); }
    finally { setSaving(false); }
  };

  const openView = async (id) => {
    try {
      const data = await getItinerary(id);
      setViewTarget(data);
    } catch { showToast('Failed to load trip details', 'error'); }
  };

  const handleAccept = async (itId, userId) => {
    try {
      await acceptJoinRequest(itId, userId);
      const updated = await getItinerary(itId);
      setViewTarget(updated);
      showToast('Request accepted', 'success');
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
  };

  const handleDecline = async (itId, userId) => {
    try {
      await declineJoinRequest(itId, userId);
      const updated = await getItinerary(itId);
      setViewTarget(updated);
      showToast('Request declined', 'success');
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
  };

  const isOwner = (it) => it.owner?._id?.toString() === user?.id?.toString() || it.owner?.toString() === user?.id?.toString();

  const ItCard = ({ it, mine = false }) => (
    <div className="bg-surface-container-lowest rounded-3xl overflow-hidden border border-outline-variant/10 shadow-sm flex flex-col">
      {it.coverImageUrl ? (
        <img src={it.coverImageUrl} alt={it.title} className="w-full h-36 object-cover" onError={e => e.target.style.display='none'} />
      ) : (
        <div className="w-full h-36 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-primary/40">travel_explore</span>
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-extrabold text-on-surface text-base leading-tight">{it.title}</h3>
          {!it.isPublic && <span className="text-[10px] bg-surface-container text-outline px-2 py-0.5 rounded-full font-bold shrink-0">Private</span>}
        </div>
        <p className="text-xs text-outline flex items-center gap-1 mb-3">
          <span className="material-symbols-outlined text-sm">location_on</span>
          {it.destination}
        </p>
        {it.description && <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{it.description}</p>}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(it.tags || []).slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{tag}</span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-outline">
            <span className="material-symbols-outlined text-sm">group</span>
            {it.members?.length ?? 0}/{it.maxMembers}
          </div>
          <div className="flex gap-2">
            <button onClick={() => openView(it._id)} className="text-xs text-primary font-bold hover:underline">Details</button>
            {mine && isOwner(it) && (
              <>
                <button onClick={() => openEdit(it)} className="text-xs text-outline hover:text-primary font-bold">Edit</button>
                <button onClick={() => handleDelete(it._id)} className="text-xs text-outline hover:text-error font-bold">Delete</button>
              </>
            )}
            {mine && !isOwner(it) && (
              <button onClick={() => handleLeave(it._id)} className="text-xs text-outline hover:text-error font-bold">Leave</button>
            )}
            {!mine && !isOwner(it) && (
              <button onClick={() => setJoinTarget(it)} className="text-xs bg-primary text-white px-3 py-1 rounded-full font-bold hover:bg-primary/90">
                Request to Join
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface pt-20">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">Trip Itineraries</h1>
            <p className="text-on-surface-variant text-sm mt-1">Plan trips, find travel buddies, explore the world</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full font-bold hover:bg-primary/90 transition-all shadow-sm">
            <span className="material-symbols-outlined text-lg">add</span>
            New Trip
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-container-low p-1 rounded-2xl mb-6 w-fit">
          {[['explore', 'explore', 'Explore'], ['mine', 'luggage', 'My Trips']].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-outline hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Search (explore only) */}
        {tab === 'explore' && (
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by destination, title or tag..."
              className="flex-1 bg-surface-container-low rounded-2xl px-5 py-3 text-sm text-on-surface placeholder:text-outline-variant outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button type="submit" className="bg-primary text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-primary/90">Search</button>
          </form>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'explore' && (
              exploreList.length === 0
                ? <div className="text-center py-20"><span className="material-symbols-outlined text-5xl text-outline block mb-3">travel_explore</span><p className="text-on-surface-variant">No itineraries found</p></div>
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exploreList.map(it => <ItCard key={it._id} it={it} />)}
                  </div>
            )}
            {tab === 'mine' && (
              myList.length === 0
                ? <div className="text-center py-20"><span className="material-symbols-outlined text-5xl text-outline block mb-3">luggage</span><p className="text-on-surface-variant">No trips yet. Create your first!</p></div>
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myList.map(it => <ItCard key={it._id} it={it} mine />)}
                  </div>
            )}
            {tab === 'explore' && explorePage < explorePages && (
              <div className="text-center mt-8">
                <button onClick={() => loadExplore(explorePage + 1)} className="text-primary font-bold text-sm hover:underline">Load more</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-extrabold text-primary">{editTarget ? 'Edit Trip' : 'Create New Trip'}</h2>
                <button onClick={() => setShowCreate(false)} className="text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                {[['title', 'Trip Title *', 'text', 'e.g. Backpacking in SE Asia'],
                  ['destination', 'Destination *', 'text', 'e.g. Thailand, Vietnam'],
                ].map(([field, label, type, ph]) => (
                  <div key={field}>
                    <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">{label}</label>
                    <input type={type} value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} placeholder={ph}
                      className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                    placeholder="Describe your trip..."
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">Start Date</label>
                    <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                      className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">End Date</label>
                    <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                      className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">Budget</label>
                    <input type="text" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="e.g. $500"
                      className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">Max Members</label>
                    <input type="number" min={1} max={50} value={form.maxMembers} onChange={e => setForm(p => ({ ...p, maxMembers: e.target.value }))}
                      className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">Tags (comma separated)</label>
                  <input type="text" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="adventure, beach, culture"
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" checked={form.isPublic} onChange={e => setForm(p => ({ ...p, isPublic: e.target.checked }))} className="sr-only peer" />
                    <div className="w-10 h-6 bg-surface-container-high rounded-full peer peer-checked:bg-primary transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                  <span className="text-sm font-bold text-on-surface">Public Trip</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-2xl border border-outline-variant text-on-surface font-bold text-sm hover:bg-surface-container-low">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50">
                    {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Trip'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {joinTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md shadow-2xl p-8">
            <h2 className="text-xl font-extrabold text-primary mb-2">Request to Join</h2>
            <p className="text-sm text-on-surface-variant mb-5">Send a request to join <span className="font-bold text-on-surface">{joinTarget.title}</span></p>
            <textarea value={joinMsg} onChange={e => setJoinMsg(e.target.value)} rows={3}
              placeholder="Introduce yourself or explain why you'd like to join (optional)..."
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20 resize-none mb-5" />
            <div className="flex gap-3">
              <button onClick={() => setJoinTarget(null)} className="flex-1 py-3 rounded-2xl border border-outline-variant text-on-surface font-bold text-sm">Cancel</button>
              <button onClick={handleJoin} disabled={saving} className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm disabled:opacity-50">
                {saving ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail/View Modal */}
      {viewTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-extrabold text-primary">{viewTarget.title}</h2>
                <button onClick={() => setViewTarget(null)} className="text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="space-y-3 text-sm mb-6">
                <p className="flex items-center gap-2 text-on-surface-variant"><span className="material-symbols-outlined text-base">location_on</span>{viewTarget.destination}</p>
                {viewTarget.startDate && <p className="flex items-center gap-2 text-on-surface-variant"><span className="material-symbols-outlined text-base">calendar_today</span>{new Date(viewTarget.startDate).toLocaleDateString()} {viewTarget.endDate && `→ ${new Date(viewTarget.endDate).toLocaleDateString()}`}</p>}
                {viewTarget.budget && <p className="flex items-center gap-2 text-on-surface-variant"><span className="material-symbols-outlined text-base">payments</span>{viewTarget.budget}</p>}
                {viewTarget.description && <p className="text-on-surface leading-relaxed">{viewTarget.description}</p>}
              </div>

              {/* Members */}
              <div className="mb-5">
                <p className="text-xs font-bold text-outline uppercase tracking-widest mb-3">Members ({viewTarget.members?.length}/{viewTarget.maxMembers})</p>
                <div className="flex flex-wrap gap-2">
                  {viewTarget.members?.map(m => (
                    <div key={m._id} className="flex items-center gap-2 bg-surface-container-low rounded-full px-3 py-1.5">
                      <Avatar profile={m} size={6} />
                      <span className="text-xs font-bold text-on-surface">{m.nickname || m.username}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Join Requests (owner only) */}
              {isOwner(viewTarget) && viewTarget.joinRequests?.filter(r => r.status === 'pending').length > 0 && (
                <div>
                  <p className="text-xs font-bold text-outline uppercase tracking-widest mb-3">Join Requests</p>
                  <div className="space-y-3">
                    {viewTarget.joinRequests.filter(r => r.status === 'pending').map(r => (
                      <div key={r._id} className="flex items-center gap-3 bg-surface-container-low rounded-2xl p-3">
                        <Avatar profile={r.user} size={8} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-on-surface">{r.user?.nickname || r.user?.username}</p>
                          {r.message && <p className="text-xs text-on-surface-variant truncate">{r.message}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleAccept(viewTarget._id, r.user._id)} className="text-xs bg-primary text-white px-3 py-1 rounded-full font-bold">Accept</button>
                          <button onClick={() => handleDecline(viewTarget._id, r.user._id)} className="text-xs bg-surface-container text-outline px-3 py-1 rounded-full font-bold">Decline</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
