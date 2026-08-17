import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationsPage() {
  const { user, profile } = useContext(AuthContext);
  const { notifications, loading, accept: hookAccept, decline: hookDecline, refetch } = useNotifications();
  const [filter, setFilter] = useState('follow');
  const navigate = useNavigate();
  // Warning modal state for unverified join requests
  const [warnModal, setWarnModal] = useState(null); // { notifId, senderName, tripTitle }

  const token = () => JSON.parse(localStorage.getItem('authTokens'))?.token;

  const handleAccept = async (id) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/notifications/${id}/accept`, {
      method: 'POST', headers: { 'x-auth-token': token() || '' },
    });
    if (res.ok) refetch();
  };

  const handleDecline = async (id) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/notifications/${id}/decline`, {
      method: 'POST', headers: { 'x-auth-token': token() || '' },
    });
    if (res.ok) refetch();
  };

  const handleRead = async (id) => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/social/notifications/${id}/read`, {
      method: 'POST', headers: { 'x-auth-token': token() || '' },
    });
    refetch();
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/social/notifications/${id}`, {
        method: 'DELETE', headers: { 'x-auth-token': token() || '' },
      });
      if (res.ok) refetch();
    } catch (err) { console.error(err); }
  };

  const displayName = profile?.nickname || user?.username || 'Traveler';
  const avatarUrl = profile?.profileIconUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuAJEN4D1jMwWgNc-0OezkvcVPNtlkRY3pfDt5Z3Ps6hlakmHndimA2jizqhwHm7b8vel9jdLKy5S_FV6Ya4SpSUGzOFxiqpzfGCGFTfOw4yEDnU-Avwb4wMgd2KQjqICH_r_2mSQf-Nv0uLGMFH2xaI37f0rlF1mh7Sz1OkqC3tpOknahI2QUXGMRWaTIxq0Z2kwxy35JsLrlcvAXr0fSEnTX8lhJeXHfu0P5aXEDeLPNjrL02cBLbzwfvXurfe5MB3g6GzbkrGdT8R";

  const followReqs = notifications.filter(n => n.type === 'follow_request' && n.status === 'pending');
  const joinReqs = notifications.filter(n => n.type === 'trip_join_request' && n.status === 'pending');
  const systemUpdates = notifications.filter(n => (n.type === 'system_update' || n.type === 'verification_approved' || n.type === 'verification_rejected') && n.status !== 'read');
  const tripUpdates = notifications.filter(n => n.type === 'trip_update' && n.status !== 'read');
  const reviewReqs = notifications.filter(n => n.type === 'review_request' && n.status === 'pending');

  const getTimeAgo = (dateStr) => {
    const s = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s/60)} mins ago`;
    if (s < 86400) return `${Math.floor(s/3600)} hrs ago`;
    return `${Math.floor(s/86400)} days ago`;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'follow') return n.type === 'follow_request' || n.type === 'follow_accepted';
    if (filter === 'join') return n.type === 'trip_join_request' || n.type === 'trip_join_accepted' || n.type === 'trip_join_declined';
    if (filter === 'system') return n.type === 'system_update' || n.type === 'verification_approved' || n.type === 'verification_rejected';
    if (filter === 'trip') return n.type === 'trip_update';
    if (filter === 'review') return n.type === 'review_request';
    return false;
  });

  return (
    <>
    <div className="bg-surface text-on-surface font-body min-h-screen">
      <Navbar />

      <main className="pt-24 min-h-screen flex justify-center">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-0 h-full w-80 xl:w-96 bg-slate-50 flex-col p-8 space-y-10 pt-24 z-10 shadow-sm">
          <div className="flex items-center gap-5 mb-4 mt-2">
            <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center shadow-md">
              <img alt="Avatar" className="h-full w-full object-cover rounded-2xl" src={avatarUrl}/>
            </div>
            <div className="truncate pr-2">
              <h3 className="font-headline font-black text-blue-900 text-2xl leading-tight truncate">{displayName}</h3>
              <p className="font-label text-xs tracking-widest uppercase text-slate-500 font-bold">{profile?.isVerified ? 'Verified Adventurer' : 'Traveler'}</p>
            </div>
          </div>
          
          <nav className="flex flex-col gap-2">
            <h4 className="font-label text-xs uppercase tracking-widest text-slate-400 font-bold px-4 mb-3">Inbox</h4>
            <div onClick={() => setFilter('follow')} className={`flex items-center justify-between px-5 py-4 rounded-2xl transition-all group cursor-pointer ${filter === 'follow' ? 'bg-white shadow-sm border border-blue-200' : 'hover:bg-white hover:shadow-sm border border-transparent'}`}>
              <div className="flex items-center gap-4">
                <span className={`material-symbols-outlined text-3xl ${filter === 'follow' ? 'text-blue-700' : 'text-slate-400 group-hover:text-blue-600'}`} style={{ fontVariationSettings: "'FILL' 0" }}>person_add</span>
                <span className={`font-body font-bold ${filter === 'follow' ? 'text-slate-700 text-base' : 'text-sm text-slate-600 group-hover:text-slate-900 group-hover:text-base transition-all'}`}>Follow Requests</span>
              </div>
              <span className={`${filter === 'follow' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'} text-xs font-bold px-3 py-1 rounded-full`}>{followReqs.length}</span>
            </div>
            <div onClick={() => setFilter('join')} className={`flex items-center justify-between px-5 py-4 rounded-2xl transition-all group mt-1 cursor-pointer ${filter === 'join' ? 'bg-white shadow-sm border border-blue-200' : 'hover:bg-white hover:shadow-sm border border-transparent'}`}>
              <div className="flex items-center gap-4">
                <span className={`material-symbols-outlined text-3xl ${filter === 'join' ? 'text-blue-700' : 'text-slate-400 group-hover:text-blue-600'}`}>event_available</span>
                <span className={`font-body font-bold ${filter === 'join' ? 'text-slate-700 text-base' : 'text-sm text-slate-600 group-hover:text-slate-900 group-hover:text-base transition-all'}`}>Join Requests</span>
              </div>
              <span className={`${filter === 'join' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'} text-xs font-bold px-3 py-1 rounded-full`}>{joinReqs.length}</span>
            </div>
            <div onClick={() => setFilter('review')} className={`flex items-center justify-between px-5 py-4 rounded-2xl transition-all group mt-1 cursor-pointer ${filter === 'review' ? 'bg-white shadow-sm border border-amber-200' : 'hover:bg-white hover:shadow-sm border border-transparent'}`}>
              <div className="flex items-center gap-4">
                <span className={`material-symbols-outlined text-3xl ${filter === 'review' ? 'text-amber-500' : 'text-slate-400 group-hover:text-amber-500'}`}>rate_review</span>
                <span className={`font-body font-bold ${filter === 'review' ? 'text-slate-700 text-base' : 'text-sm text-slate-600 group-hover:text-slate-900 group-hover:text-base transition-all'}`}>Trip Reviews</span>
              </div>
              <span className={`${filter === 'review' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'} text-xs font-bold px-3 py-1 rounded-full`}>{reviewReqs.length}</span>
            </div>
          </nav>
          
          <nav className="flex flex-col gap-2 pt-6 border-t border-slate-200">
            <h4 className="font-label text-xs uppercase tracking-widest text-slate-400 font-bold px-4 mb-3">System Updates</h4>
            <div onClick={() => setFilter('system')} className={`flex items-center justify-between px-5 py-4 rounded-2xl transition-all group cursor-pointer ${filter === 'system' ? 'bg-white shadow-sm border border-red-200' : 'hover:bg-white hover:shadow-sm border border-transparent'}`}>
              <div className="flex items-center gap-4">
                <span className={`material-symbols-outlined text-2xl ${filter === 'system' ? 'text-red-500' : 'text-slate-400 group-hover:text-red-500'}`}>shield</span>
                <span className={`font-body font-semibold ${filter === 'system' ? 'text-slate-900 text-base' : 'text-sm text-slate-600 group-hover:text-slate-900'}`}>System News</span>
              </div>
              <span className={`${filter === 'system' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600'} text-xs font-bold px-3 py-1 rounded-full`}>{systemUpdates.length}</span>
            </div>
            <div onClick={() => setFilter('trip')} className={`flex items-center justify-between px-5 py-4 rounded-2xl transition-all group mt-1 cursor-pointer ${filter === 'trip' ? 'bg-white shadow-sm border border-blue-200' : 'hover:bg-white hover:shadow-sm border border-transparent'}`}>
              <div className="flex items-center gap-4">
                <span className={`material-symbols-outlined text-2xl ${filter === 'trip' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`}>flight_takeoff</span>
                <span className={`font-body font-semibold ${filter === 'trip' ? 'text-slate-900 text-base' : 'text-sm text-slate-600 group-hover:text-slate-900'}`}>Trip Updates</span>
              </div>
              <span className={`${filter === 'trip' ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-600'} text-xs font-bold px-3 py-1 rounded-full`}>{tripUpdates.length}</span>
            </div>
          </nav>
        </aside>

        {/* Middle: Notification List */}
        <section className="flex-1 px-4 sm:px-6 lg:ml-80 xl:ml-96 lg:mr-96 xl:mr-[400px] max-w-4xl pt-4 mx-auto">
          <header className="mb-10">
            <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-primary tracking-tight mb-2">Notifications Center</h1>
            <p className="text-slate-500 font-body text-xl">Manage your trip requests, followers, and invites.</p>
          </header>

          {/* Verification Warning Banner — only for 'none' or 'unverified' */}
          {(profile?.verificationStatus === 'none' || profile?.verificationStatus === 'unverified') && (
            <div 
              onClick={() => navigate('/verification')}
              className="mb-10 p-5 rounded-2xl flex items-start gap-4 cursor-pointer transition-all hover:shadow-md border bg-amber-50 border-amber-200 hover:bg-amber-100"
            >
              <span className="material-symbols-outlined text-3xl text-amber-500">warning</span>
              <div>
                <h3 className="font-bold text-amber-800">System News: Verification Required</h3>
                <p className="text-sm mt-1 text-amber-700">
                  {profile?.verificationStatus === 'unverified'
                    ? 'You are not a verified user. Your previous verification was rejected. Click here to try again.'
                    : 'You are not a verified user. Click here to become a verified user and unlock all features.'}
                </p>
              </div>
            </div>
          )}

          {/* Pending review info — non-clickable, shown only when pending */}
          {profile?.verificationStatus === 'pending' && (
            <div className="mb-10 p-5 rounded-2xl flex items-start gap-4 border bg-blue-50 border-blue-200">
              <span className="material-symbols-outlined text-3xl text-blue-500">info</span>
              <div>
                <h3 className="font-bold text-blue-800">System News: Verification Under Review</h3>
                <p className="text-sm mt-1 text-blue-700">Your documents are being reviewed by an admin. You will be notified once the review is complete.</p>
              </div>
            </div>
          )}

          {/* Quick Stats Top Section */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
            <div className="bg-white p-5 rounded-3xl shadow-sm border-b-4 border-blue-600">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Follows</p>
              <p className="text-2xl font-black text-blue-900">{followReqs.length}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border-b-4 border-teal-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Joins</p>
              <p className="text-2xl font-black text-blue-900">{joinReqs.length}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border-b-4 border-amber-400">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reviews</p>
              <p className="text-2xl font-black text-amber-600">{reviewReqs.length}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border-b-4 border-red-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System</p>
              <p className="text-2xl font-black text-red-600">{systemUpdates.length}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border-b-4 border-slate-300">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Trips</p>
              <p className="text-2xl font-black text-slate-800">{tripUpdates.length}</p>
            </div>
          </div>

          {/* Notifications Feed */}
          {loading ? (
            <div className="space-y-6 pb-12">
              {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-3xl p-8 h-32 animate-pulse shadow-sm border border-slate-100" />)}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm mt-8">
                <span className="material-symbols-outlined text-6xl text-slate-200 mb-6 block">notifications_off</span>
                <p className="font-headline text-2xl font-black text-slate-600">No notifications found</p>
                <p className="text-base text-slate-400 mt-2">Check another category or you're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-5 pb-20">
              {filteredNotifications.map(n => {
                const isPending = n.status === 'pending';
                const isRead = n.status === 'read';
                const cardClasses = `bg-white p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center gap-6 transition-all hover:shadow-xl border border-slate-100 group relative ${isRead ? 'opacity-60' : ''}`;
                const senderAvatarUrl = n.sender?.profileIconUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuAJEN4D1jMwWgNc-0OezkvcVPNtlkRY3pfDt5Z3Ps6hlakmHndimA2jizqhwHm7b8vel9jdLKy5S_FV6Ya4SpSUGzOFxiqpzfGCGFTfOw4yEDnU-Avwb4wMgd2KQjqICH_r_2mSQf-Nv0uLGMFH2xaI37f0rlF1mh7Sz1OkqC3tpOknahI2QUXGMRWaTIxq0Z2kwxy35JsLrlcvAXr0fSEnTX8lhJeXHfu0P5aXEDeLPNjrL02cBLbzwfvXurfe5MB3g6GzbkrGdT8R";
                const senderName = n.sender?.nickname || n.sender?.username || 'Someone';

                return (
                  <div key={n._id} className={cardClasses}>
                    <button 
                      onClick={() => handleDelete(n._id)}
                      className="absolute right-4 top-4 sm:right-6 sm:top-auto sm:relative text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-full hover:bg-red-50"
                      title="Delete notification"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                    
                    <div className="h-16 w-16 rounded-full bg-slate-100 overflow-hidden flex-shrink-0 cursor-pointer shadow-sm" onClick={() => navigate(`/profile/${n.sender?._id}`)}>
                      <img alt={senderName} className="w-full h-full object-cover" src={senderAvatarUrl}/>
                    </div>
                    
                    <div className="flex-1 w-full min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-headline font-black text-primary text-xl truncate pr-4 cursor-pointer hover:underline" onClick={() => navigate(`/profile/${n.sender?._id}`)}>{senderName}</h4>
                        <span className="text-xs text-slate-400 font-bold whitespace-nowrap bg-slate-50 px-2 py-1 rounded-lg">{getTimeAgo(n.createdAt)}</span>
                      </div>
                      
                      {n.type === 'follow_request' && (
                        <>
                           <p className="text-slate-600 font-body text-base mb-4 leading-relaxed">Wants to follow your travel updates and itineraries.</p>
                           {isPending ? (
                             <div className="flex flex-wrap gap-3">
                               <button onClick={() => handleAccept(n._id)} className="bg-primary text-white px-8 py-2.5 rounded-full text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-900/20">Accept</button>
                               <button onClick={() => handleDecline(n._id)} className="bg-slate-100 text-slate-600 px-8 py-2.5 rounded-full text-sm font-black hover:bg-slate-200 transition-all">Ignore</button>
                               <button onClick={() => navigate(`/profile/${n.sender?._id}`)} className="text-blue-600 text-sm font-bold hover:underline ml-2">View Profile</button>
                             </div>
                           ) : (
                              <p className="text-xs font-black text-slate-500 bg-slate-100 border border-slate-200 px-4 py-2 rounded-full shrink-0 w-fit">{n.status === 'accepted' ? 'REQUEST ACCEPTED' : 'REQUEST DECLINED'}</p>
                           )}
                        </>
                      )}

                      {n.type === 'trip_join_request' && (
                        <>
                           <p className="text-slate-600 font-body text-base mb-4 leading-relaxed">
                             Wants to join your trip <span className="font-extrabold text-primary">"{n.itinerary?.title || 'Untitled'}"</span>
                           </p>
                           {isPending ? (
                             <div className="flex flex-wrap gap-3">
                               <button
                                 onClick={() => {
                                   if (!n.sender?.isVerified) {
                                     // Show warning modal for unverified senders
                                     setWarnModal({
                                       notifId: n._id,
                                       senderName: n.sender?.nickname || n.sender?.username || 'this user',
                                       tripTitle: n.itinerary?.title || 'your trip',
                                     });
                                   } else {
                                     handleAccept(n._id);
                                   }
                                 }}
                                 className="bg-secondary text-white px-8 py-2.5 rounded-full text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-900/20"
                               >
                                 Accept
                               </button>
                               <button onClick={() => handleDecline(n._id)} className="bg-slate-100 text-slate-600 px-8 py-2.5 rounded-full text-sm font-black hover:bg-slate-200 transition-all">Decline</button>
                               <button onClick={() => navigate(`/profile/${n.sender?._id}`)} className="text-secondary text-sm font-bold hover:underline ml-2">View Profile</button>
                             </div>
                           ) : (
                              <p className="text-xs font-black text-slate-500 bg-slate-100 border border-slate-200 px-4 py-2 rounded-full shrink-0 w-fit">{n.status === 'accepted' ? 'REQUEST ACCEPTED' : 'REQUEST DECLINED'}</p>
                           )}
                        </>
                      )}

                      {n.type === 'follow_accepted' && (
                        <>
                           <p className="text-slate-600 font-body text-base mb-4 leading-relaxed">Accepted your follow request. You can now engage directly in chats.</p>
                           <div className="flex gap-5 items-center">
                             <button onClick={() => navigate(`/profile/${n.sender?._id}`)} className="text-blue-600 text-sm font-bold hover:underline whitespace-nowrap">View Profile</button>
                             {!isRead && <button onClick={() => handleRead(n._id)} className="text-slate-400 font-black hover:text-slate-600 text-xs transition-colors uppercase tracking-widest">Mark as Read</button>}
                           </div>
                        </>
                      )}

                      {n.type === 'trip_join_accepted' && (
                        <>
                           <p className="text-slate-600 font-body text-base mb-4 leading-relaxed">
                             Accepted your request to join <span className="font-extrabold text-primary">"{n.itinerary?.title || 'Untitled'}"</span>
                           </p>
                           <div className="flex flex-wrap gap-3">
                              <button onClick={() => { handleRead(n._id); navigate(`/trip/${n.itinerary?._id}`); }} className="bg-primary text-white border border-primary px-7 py-2.5 rounded-full text-sm font-black hover:scale-105 transition-all shadow-lg shadow-blue-900/10 whitespace-nowrap">View Plan</button>
                              <button onClick={() => { handleRead(n._id); navigate('/chatpage', { state: { openThread: n.itinerary?._id, isGroup: true } }); }} className="bg-teal-500 text-white border border-teal-500 px-7 py-2.5 rounded-full text-sm font-black hover:scale-105 transition-all shadow-lg shadow-teal-500/10 whitespace-nowrap hidden sm:inline-block">Open Chat</button>
                              {!isRead && <button onClick={() => handleRead(n._id)} className="text-slate-400 font-black hover:text-slate-600 text-xs transition-colors ml-2 uppercase tracking-widest">Mark read</button>}
                           </div>
                        </>
                      )}

                      {n.type === 'trip_join_declined' && (
                        <>
                           <p className="text-slate-600 font-body text-base mb-4 leading-relaxed">
                             Regretfully declined your request to join <span className="font-extrabold text-primary">"{n.itinerary?.title || 'Untitled'}"</span>
                           </p>
                           <div className="flex flex-wrap gap-3">
                              {!isRead && <button onClick={() => handleRead(n._id)} className="text-slate-400 font-black hover:text-slate-600 text-xs transition-colors uppercase tracking-widest">Mark as Read</button>}
                              <button onClick={() => navigate('/browsepage')} className="text-primary text-sm font-bold hover:underline">Find other trips</button>
                           </div>
                        </>
                      )}

                      {n.type === 'review_request' && (
                        <>
                          <p className="text-slate-600 font-body text-base mb-1 leading-relaxed">
                            How was your trip <span className="font-extrabold text-primary">"{n.itinerary?.title || 'Untitled'}"</span>?
                          </p>
                          <p className="text-slate-400 text-xs mb-4">Share your experience to help future travelers.</p>
                          {isPending ? (
                            <div className="flex flex-wrap gap-3">
                              <button
                                onClick={() => {
                                  handleRead(n._id);
                                  navigate('/review', { state: { itineraryId: n.itinerary?._id, itineraryTitle: n.itinerary?.title } });
                                }}
                                className="bg-amber-500 text-white px-8 py-2.5 rounded-full text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
                              >
                                ✍️ Review
                              </button>
                              <button
                                onClick={() => handleDecline(n._id)}
                                className="bg-slate-100 text-slate-600 px-8 py-2.5 rounded-full text-sm font-black hover:bg-slate-200 transition-all"
                              >
                                Don't Review
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs font-black text-slate-500 bg-slate-100 border border-slate-200 px-4 py-2 rounded-full shrink-0 w-fit">
                              {n.status === 'read' ? 'REVIEWED' : 'DISMISSED'}
                            </p>
                          )}
                        </>
                      )}

                      {(n.type === 'trip_update' || n.type === 'system_update' || n.type === 'verification_approved' || n.type === 'verification_rejected') && (
                        <>
                           <p className="text-slate-600 font-body text-base mb-4 leading-relaxed">{n.message || 'There was an update to your itinerary.'}</p>
                           {!isRead && (
                             <button onClick={() => handleRead(n._id)} className="text-slate-400 font-black hover:text-slate-600 text-xs transition-colors uppercase tracking-widest">Mark as Read</button>
                           )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Dashboard */}
        <aside className="hidden xl:flex fixed right-0 top-0 h-full w-96 bg-white/40 backdrop-blur-md flex-col p-10 space-y-12 pt-24 z-10 shadow-sm">
          <section>
            <h5 className="font-headline font-black text-primary text-2xl mb-8">Discovery</h5>
            <div className="bg-primary-container p-8 rounded-[40px] text-white relative overflow-hidden group shadow-2xl shadow-blue-900/30">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
              <h6 className="font-headline font-black text-2xl mb-4 relative z-10 leading-tight">Join a trip and expand your circle</h6>
              <p className="text-white/80 text-base mb-8 leading-relaxed relative z-10 font-medium">Connect automatically with past trip members and fellow explorers.</p>
              <button onClick={() => navigate('/browsepage')} className="w-full bg-white text-primary font-black py-4 rounded-2xl text-base relative z-10 hover:bg-slate-50 active:scale-95 transition-all shadow-2xl">
                Browse Trips
              </button>
            </div>
          </section>

          <div className="mt-auto bg-blue-50 p-8 rounded-[32px] border border-blue-100 flex flex-col gap-3">
            <p className="text-xs font-label uppercase tracking-widest text-blue-700 font-black flex items-center gap-2"><span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span> TRAVEL TIP</p>
            <p className="text-base text-blue-900/80 leading-relaxed italic font-medium">"Verified profiles get 4x more join requests for their curated itineraries. Complete your bio to get started."</p>
          </div>
        </aside>
      </main>
    </div>

      {/* ── Unverified User Warning Modal ── */}
      {warnModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Red header bar */}
            <div className="bg-red-500 px-8 py-5 flex items-center gap-3">
              <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <h2 className="text-white font-black text-xl tracking-tight">Unverified User Warning</h2>
            </div>

            <div className="px-8 py-6">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
                <p className="text-red-800 font-medium leading-relaxed text-sm">
                  Please note that you are trying to add an <span className="font-black">unverified user</span> to your itinerary plan
                  {warnModal.tripTitle ? <span> <span className="font-black text-red-900">"{warnModal.tripTitle}"</span></span> : ''}.
                  This can place <span className="font-black">both you and your itinerary members at risk</span>.
                </p>
                <p className="text-red-700 font-semibold text-sm mt-3">
                  Please only accept this request if you personally know <span className="font-black">{warnModal.senderName}</span>.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setWarnModal(null)}
                  className="flex-1 bg-slate-100 text-slate-700 py-3.5 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleAccept(warnModal.notifId);
                    setWarnModal(null);
                  }}
                  className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-black hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
                >
                  Accept Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
