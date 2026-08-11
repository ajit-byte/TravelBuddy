import { useContext, useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useWebSettings } from '../context/WebSettingsContext';

const navItems = [
  { to: "/homepage", label: "Dashboard" },
  { to: "/browsepage", label: "Explore" },
  { to: "/itineraryplanningpage", label: "My Trips" },
  { to: "/posts", label: "Posts" },
  { to: "/chatpage", label: "Chat" },
];

export default function Navbar({ showAuth = true, transparent = false }) {
  const { user, profile, logout } = useContext(AuthContext);
  const { unreadCount: notificationsCount } = useNotifications();
  const { t } = useWebSettings();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }
    const fetchUnread = async () => {
      try {
        const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/unread-count`, {
          headers: { 'x-auth-token': token || '' }
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadMessages(data.count);
        }
      } catch (err) { console.error(err); }
    };
    setUnreadMessages(0); // clear stale count from previous account
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    const handleChatRead = () => fetchUnread();
    window.addEventListener('chat:read', handleChatRead);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('chat:read', handleChatRead);
    };
  }, [user?.id]); // re-run when the user ID changes, not just when user object changes

  const displayName = profile?.nickname || user?.username || '?';
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const avatarSrc = profile?.profileIconUrl || null;

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}&type=itinerary`);
    setSearchQuery('');
  };

  const navClass = transparent 
    ? "fixed top-0 w-full z-50 h-20 flex justify-between items-center px-4 md:px-8 font-['Manrope'] antialiased bg-transparent"
    : "fixed top-0 w-full z-50 bg-slate-50/80 backdrop-blur-xl shadow-sm h-20 flex justify-between items-center px-4 md:px-8 font-['Manrope'] antialiased border-b border-slate-200/50";

  return (
    <>
    <nav className={navClass}>
      {/* Logo */}
      <div 
        className="flex items-center gap-12 cursor-pointer shrink-0" 
        onClick={() => navigate(user ? "/homepage" : "/")}
      >
        <div className="text-2xl font-black text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>explore</span>
          TravelBuddy
        </div>
      </div>

      {/* Centered Nav Links */}
      {user && (
        <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => {
                let base = isActive
                  ? "text-primary font-bold border-b-2 border-primary pb-1 transition-all duration-300 whitespace-nowrap"
                  : "text-slate-500 font-medium hover:text-primary transition-all duration-300 whitespace-nowrap";
                
                if (item.label === 'Chat' && unreadMessages > 0) {
                  return base + " animate-pulse-orange";
                }
                
                return base;
              }}
            >
              {t(item.label)}
            </NavLink>
          ))}
        </div>
      )}

      {/* Right Side */}
      <div className="flex items-center gap-4 md:gap-6 shrink-0">
        {user ? (
          <>
            {/* Search */}
            <form onSubmit={handleSearch} className="relative hidden lg:block">
              <input 
                id="navbar-search"
                name="search"
                className="bg-slate-100/50 border-none rounded-full px-6 py-2 w-64 focus:ring-2 focus:ring-primary/30 text-sm outline-none placeholder:text-slate-400" 
                placeholder={t("Search destinations, tags...")} 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <span className="material-symbols-outlined absolute right-4 top-2 text-slate-400 cursor-pointer text-xl">search</span>
            </form>

            {/* Notifications */}
            <button onClick={() => navigate('/notifications')} className="relative hover:bg-slate-100 rounded-xl p-2.5 transition-all active:scale-90 duration-200 text-primary">
              <span className="material-symbols-outlined text-3xl">notifications</span>
              {notificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-error rounded-full border-2 border-white shadow-sm transition-all animate-bounce"></span>
              )}
            </button>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 hover:border-primary transition-colors cursor-pointer active:scale-95 duration-200"
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {avatarInitial}
                  </div>
                )}
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <p className="font-bold text-slate-900 truncate">{displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  
                  <button
                    onClick={() => { setShowMenu(false); navigate('/profile'); }}
                    className="flex items-center gap-3 w-full px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl opacity-70">person</span>
                    Profile
                  </button>
                  
                  <button
                    onClick={() => { setShowMenu(false); navigate('/settings'); }}
                    className="flex items-center gap-3 w-full px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl opacity-70">settings</span>
                    {t('Settings')}
                  </button>
                  
                  <div className="border-t border-slate-100 mt-1" />
                  
                  <button
                    onClick={() => { setShowMenu(false); logout(); }}
                    className="flex items-center gap-3 w-full px-5 py-2.5 text-sm font-bold text-error hover:bg-error/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">logout</span>
                    {t('Logout')}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          showAuth && (
            <div className="flex gap-4">
              <button onClick={() => navigate('/login')} className="text-slate-600 hover:text-primary font-bold transition-colors text-sm">
                Log in
              </button>
              <button onClick={() => navigate('/signup')} className="adventure-gradient text-white px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 shadow-lg active:scale-95 transition-all">
                Join Now
              </button>
            </div>
          )
        )}
      </div>
    </nav>
    
    {/* Bottom Mobile Navigation (Visible only on small screens) */}
    {user && (
      <nav className="lg:hidden fixed bottom-0 w-full h-16 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 flex justify-around items-center px-4 z-50">
        {navItems.map(item => {
          const isChatUnread = item.label === 'Chat' && unreadMessages > 0;
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-all ${
                  isActive ? 'text-primary' : 'text-slate-400 hover:text-primary'
                } ${isChatUnread ? 'animate-pulse-orange' : ''}`
              }
            >
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: location.pathname === item.to ? "'FILL' 1" : undefined }}>
                {item.label === 'Dashboard' ? 'grid_view' : 
                 item.label === 'Explore' ? 'explore' : 
                 item.label === 'My Trips' ? 'route' : 
                 item.label === 'Posts' ? 'person' : 
                 item.label === 'Chat' ? 'chat' : 'circle'}
              </span>
              <span className="text-[10px] font-bold">{t(item.label)}</span>
            </NavLink>
          );
        })}
      </nav>
    )}
    </>
  );
}
