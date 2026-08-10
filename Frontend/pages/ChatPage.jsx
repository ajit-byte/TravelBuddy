import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { useWebSettings } from '../context/WebSettingsContext';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet marker fix
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
    // Force Leaflet to recalculate its container size to fix grey tiles
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    if (center) map.flyTo(center, 14, { animate: true });
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
}

let socket = null;

function StatusTicks({ status }) {
  if (status === 'read') return <span className="text-blue-400 text-xs ml-1">✓✓</span>;
  if (status === 'delivered') return <span className="text-gray-400 text-xs ml-1">✓✓</span>;
  return <span className="text-gray-400 text-xs ml-1">✓</span>;
}

export default function ChatPage() {
  const { user } = useContext(AuthContext);
  const { t } = useWebSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // Immediately clear the chat nav blink when the user lands on this page
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chat:read'));
  }, []);
  const [friends, setFriends] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionSearch, setConnectionSearch] = useState('');
  const [msgSearch, setMsgSearch] = useState('');
  const [msgSearchResults, setMsgSearchResults] = useState([]);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [globalResults, setGlobalResults] = useState([]);
  const [showGlobalResults, setShowGlobalResults] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeen, setLastSeen] = useState({});
  const [sending, setSending] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaFileType, setMediaFileType] = useState('image'); // 'image' | 'video' | 'audio'
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [isSearchingLoc, setIsSearchingLoc] = useState(false);
  const [tempSelectedLoc, setTempSelectedLoc] = useState(null);
  const [matchScore, setMatchScore] = useState(null);
  // Video lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null);
  // Audio recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  // Message context menu (delete)
  const [msgMenu, setMsgMenu] = useState(null);
  // Selected messages
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  // Forward modal
  const [forwardMsg, setForwardMsg] = useState(null); // message object to forward
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardTarget, setForwardTarget] = useState(null);
  
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const token = JSON.parse(localStorage.getItem('authTokens'))?.token;


  useEffect(() => {
    if (!token) return;
    socket = io(import.meta.env.VITE_API_URL, { auth: { token } });
    socket.on('user:online', ({ userId }) => setOnlineUsers(prev => new Set([...prev, userId])));
    socket.on('user:offline', ({ userId, lastSeen: ls }) => {
      setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
      setLastSeen(prev => ({ ...prev, [userId]: ls }));
    });
    socket.on('message:new', ({ message }) => {
      setMessages(prev => {
        // Deduplicate: skip if this message ID already exists (sent by us via optimistic update)
        if (prev.some(m => m._id === message._id)) return prev;
        // Also replace any temp optimistic message that matches by content+sender
        const hasTempMatch = prev.some(
          m => m._id?.startsWith('temp-') &&
               m.sender?._id === message.sender?._id &&
               m.content === message.content
        );
        if (hasTempMatch) {
          return prev.map(m =>
            m._id?.startsWith('temp-') &&
            m.sender?._id === message.sender?._id &&
            m.content === message.content
              ? message
              : m
          );
        }
        return [...prev, message];
      });
      socket.emit('message:delivered', { messageId: message._id, threadId: message.threadId, toUserId: message.sender._id });
    });
    socket.on('message:delivered', ({ messageId }) =>
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, status: 'delivered' } : m)));
    socket.on('message:read', ({ messageId }) =>
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, status: 'read' } : m)));
    socket.on('message:deleted', ({ messageId }) =>
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true, content: '', attachments: [] } : m)));
    socket.on('typing:start', ({ fromUserId }) => setTypingUsers(prev => ({ ...prev, [fromUserId]: true })));
    socket.on('typing:stop', ({ fromUserId }) => setTypingUsers(prev => ({ ...prev, [fromUserId]: false })));
    return () => { socket?.disconnect(); socket = null; };
  }, [token]);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/users`, {
          headers: { 'x-auth-token': token || '' },
        });
        if (res.ok) {
          const data = await res.json();
          setFriends(data);
          setOnlineUsers(new Set(data.filter(u => u.online).map(u => u._id)));
          
          // Auto-select thread from notification/navigation
          if (location.state?.openThread) {
            let match = data.find(f => 
              (location.state.isGroup && f.itineraryId === location.state.openThread) ||
              (!location.state.isGroup && f._id === location.state.openThread)
            );
            
            // If they are not in our mutual friends list, fetch their profile and add them temporarily
            if (!match && !location.state.isGroup) {
              try {
                const userRes = await fetch(`${import.meta.env.VITE_API_URL}/api/social/profile/${location.state.openThread}`, {
                  headers: { 'x-auth-token': token || '' }
                });
                if (userRes.ok) {
                  const targetUser = await userRes.json();
                  match = { 
                    ...targetUser,
                    chatType: 'direct'
                  };
                  data.unshift(match);
                  setFriends([...data]);
                }
              } catch (err) { console.error('Error fetching non-friend user:', err); }
            }
            
            if (match) setSelectedUser(match);
          }
        }
      } catch (err) { console.error(err); }
      finally { setLoadingUsers(false); }
    };
    fetchFriends();
  }, [location.state]);

  useEffect(() => {
    if (!selectedUser) return;
    setLoadingMessages(true);
    setMessages([]);
    setSelectedMessages(new Set());
    const fetchMessages = async () => {
      try {
        const endpoint = selectedUser.isGroup 
          ? `${import.meta.env.VITE_API_URL}/api/chat/group/thread/${selectedUser._id}`
          : `${import.meta.env.VITE_API_URL}/api/chat/thread/${selectedUser._id}`;
          
        const res = await fetch(endpoint, {
          headers: { 'x-auth-token': token || '' },
        });
        if (res.ok) {
          const data = await res.json();
          setThreadId(data.threadId);
          setMessages(data.messages);

          // Persist read status to DB and clear the nav blink
          const hasUnread = data.messages.some(m => m.sender?._id !== user.id && m.status !== 'read');
          if (hasUnread) {
            // Mark all as read in DB
            fetch(`${import.meta.env.VITE_API_URL}/api/chat/thread/${selectedUser._id}/read`, {
              method: 'POST',
              headers: { 'x-auth-token': token || '' },
            }).catch(() => {});

            // Emit socket read events
            data.messages.forEach(m => {
              if (m.sender?._id !== user.id && m.status !== 'read') {
                socket?.emit('message:read', { messageId: m._id, threadId: data.threadId, toUserId: m.sender?._id });
              }
            });

            window.dispatchEvent(new CustomEvent('chat:read'));
          }
        }
      } catch (err) { console.error(err); }
      finally { setLoadingMessages(false); }
    };
    fetchMessages();
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedUser || selectedUser.isGroup) {
      setMatchScore(null);
      return;
    }
    const fetchScore = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/matching/score/${selectedUser._id}`, {
          headers: { 'x-auth-token': token || '' }
        });
        if (res.ok) {
          const data = await res.json();
          setMatchScore(data);
        }
      } catch(err) { console.error(err); }
    };
    fetchScore();
  }, [selectedUser, token]);

  useEffect(() => {
    if (threadId) {
      socket?.emit('thread:join', { threadId });
    }
  }, [threadId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!selectedUser) return;
    socket?.emit('typing:start', { threadId, toUserId: selectedUser._id });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket?.emit('typing:stop', { threadId, toUserId: selectedUser._id });
    }, 1500);
  };

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || !selectedUser) return;
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      sender: { _id: user.id },
      content: newMessage.trim(),
      status: 'sent',
      createdAt: new Date().toISOString(),
      attachments: mediaPreview ? [{ url: mediaPreview, fileType: mediaFileType }] : [],
    };
    setMessages(prev => [...prev, optimistic]);
    const msgText = newMessage.trim();
    setNewMessage('');
    
    socket?.emit('typing:stop', { threadId, toUserId: selectedUser.isGroup ? null : selectedUser._id });
    try {
      let res;
      if (mediaFile) {
        const fd = new FormData();
        fd.append('toUserId', selectedUser._id);
        fd.append('file', mediaFile);
        fd.append('fileType', mediaFile.type.startsWith('video') ? 'video' : mediaFile.type.startsWith('audio') ? 'audio' : 'image');
        fd.append('isGroup', selectedUser.isGroup ? 'true' : 'false');
        res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/send-media`, {
          method: 'POST', headers: { 'x-auth-token': token || '' }, body: fd,
        });
        setMediaFile(null); setMediaPreview(null); setMediaFileType('image');
      } else {
        res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
          body: JSON.stringify({ toUserId: selectedUser._id, content: msgText, isGroup: !!selectedUser.isGroup }),
        });
      }
      if (res.ok) {
        const real = await res.json();
        setMessages(prev => prev.map(m => m._id === tempId ? real : m));
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.filter(m => m._id !== tempId));
    } finally { setSending(false); }
  };

  const handleLocationSearch = async (e) => {
    e?.preventDefault();
    if (!locationSearchQuery.trim()) return;
    setIsSearchingLoc(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const formatted = data.map(item => ({
          id: item.place_id,
          title: item.display_name.split(',')[0],
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }));
        setLocationResults(formatted);
      } else {
        setLocationResults([]);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setLocationResults([]);
    } finally {
      setIsSearchingLoc(false);
    }
  };

  const confirmLocation = async () => {
    if (!tempSelectedLoc || !selectedUser) return;
    const tempId = `loc-${Date.now()}`;
    const locationData = {
      title: tempSelectedLoc.title,
      address: tempSelectedLoc.address,
      lat: tempSelectedLoc.lat,
      lng: tempSelectedLoc.lng,
    };
    
    // Optimistic UI update
    const optimistic = {
      _id: tempId,
      sender: { _id: user.id },
      type: 'location',
      location: locationData,
      status: 'sent',
      createdAt: new Date().toISOString(),
      showMap: true
    };
    setMessages(prev => [...prev, optimistic]);
    setIsLocationPickerOpen(false);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
        body: JSON.stringify({
          toUserId: selectedUser._id,
          type: 'location',
          location: locationData
        }),
      });
      if (res.ok) {
        const real = await res.json();
        setMessages(prev => prev.map(m => m._id === tempId ? { ...real, showMap: true } : m));
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.filter(m => m._id !== tempId));
    } finally {
      setTempSelectedLoc(null);
      setLocationSearchQuery('');
      setLocationResults([]);
    }
  };

  const sendLocation = () => {
    // This now opens the picker instead of immediate sending
    setShowAttachmentMenu(false);
    setIsLocationPickerOpen(true);
  };

  // ── Audio recorder ────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record audio.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const sendRecordedAudio = async () => {
    if (!audioBlob || !selectedUser) return;
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      sender: { _id: user.id },
      attachments: [{ url: audioPreviewUrl, fileType: 'audio' }],
      status: 'sent',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const fd = new FormData();
      fd.append('toUserId', selectedUser._id);
      fd.append('file', file);
      fd.append('fileType', 'audio');
      fd.append('isGroup', selectedUser.isGroup ? 'true' : 'false');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/send-media`, {
        method: 'POST',
        headers: { 'x-auth-token': token || '' },
        body: fd,
      });
      if (res.ok) {
        const real = await res.json();
        setMessages(prev => prev.map(m => m._id === tempId ? real : m));
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.filter(m => m._id !== tempId));
    } finally {
      setSending(false);
      cancelRecording();
    }
  };

  const formatRecordingTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Message delete ────────────────────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    setMsgMenu(null);
    const msg = messages.find(m => m._id === messageId);
    const isSender = msg?.sender?._id === user.id || msg?.sender?._id?.toString() === user.id;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/message/${messageId}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token || '' },
      });
      if (res.ok) {
        if (isSender) {
          // Sender delete — trail shown to both sides (socket handles other side)
          setMessages(prev => prev.map(m =>
            m._id === messageId ? { ...m, deleted: true, content: '', attachments: [] } : m
          ));
        } else {
          // Receiver delete — hide only locally, show "deleted from view" text
          setMessages(prev => prev.map(m =>
            m._id === messageId ? { ...m, deletedForMe: true } : m
          ));
        }
      }
    } catch (err) { console.error(err); }
  };

  const toggleSelectMessage = (messageId) => {
    setMsgMenu(null);
    setSelectedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const clearSelection = () => setSelectedMessages(new Set());

  // ── Forward message ───────────────────────────────────────────────────
  const handleForward = async () => {
    if (!forwardMsg || !forwardTarget) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
        body: JSON.stringify({ toUserId: forwardTarget._id, content: forwardMsg.content || '📎 Forwarded media' }),
      });
    } catch (err) { console.error(err); }
    setForwardMsg(null);
    setForwardTarget(null);
    setForwardSearch('');
  };

  const handleDeleteChat = async () => {
    if (!selectedUser || !threadId) return;
    if (!window.confirm(`Delete chat with ${selectedUser.nickname || selectedUser.username}? This cannot be undone.`)) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/chat/thread/${threadId}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token || '' },
      });
      setSelectedUser(null);
      setMessages([]);
      setThreadId(null);
      setShowChatMenu(false);
    } catch (err) { console.error(err); }
  };

  const handleMsgSearch = useCallback(async (q) => {
    setMsgSearch(q);
    if (!q.trim() || !selectedUser) { setMsgSearchResults([]); return; }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/chat/search/${selectedUser._id}?q=${encodeURIComponent(q)}`,
        { headers: { 'x-auth-token': token || '' } }
      );
      if (res.ok) setMsgSearchResults(await res.json());
    } catch (_) {}
  }, [selectedUser, token]);

  const handleGlobalSearch = useCallback(async (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setGlobalResults([]);
      setShowGlobalResults(false);
      return;
    }
    
    setIsSearchingGlobal(true);
    setShowGlobalResults(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/posts/users/search?q=${encodeURIComponent(q)}&notConnected=true`,
        { headers: { 'x-auth-token': token || '' } }
      );
      if (res.ok) {
        setGlobalResults(await res.json());
      }
    } catch (err) {
      console.error('Global search error:', err);
    } finally {
      setIsSearchingGlobal(false);
    }
  }, [token]);

  const filteredFriends = friends.filter(u =>
    (u.nickname || u.username).toLowerCase().includes(connectionSearch.toLowerCase())
  );
  const isOnline = selectedUser && onlineUsers.has(selectedUser._id);
  const ls = selectedUser && lastSeen[selectedUser._id];


  return (
    <div className="fixed inset-0 bg-surface flex flex-col font-body text-on-surface overflow-hidden pt-20">

      <Navbar />

      {/* ── Video Lightbox ─────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-5 right-5 text-white hover:text-slate-300 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <span className="material-symbols-outlined text-4xl">close</span>
          </button>
          <video
            src={lightboxUrl}
            controls
            autoPlay
            className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Forward Modal ──────────────────────────────────────────────── */}
      {forwardMsg && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center" onClick={() => { setForwardMsg(null); setForwardTarget(null); setForwardSearch(''); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-base text-on-surface">Forward to</h3>
            </div>
            {/* Preview of message being forwarded */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-xs text-outline font-medium mb-1">Forwarding:</p>
              <p className="text-sm text-on-surface truncate italic">
                {forwardMsg.content || (forwardMsg.attachments?.length ? `📎 ${forwardMsg.attachments[0].fileType}` : '...')}
              </p>
            </div>
            {/* Search friends */}
            <div className="px-5 py-3 border-b border-slate-100">
              <input
                autoFocus
                value={forwardSearch}
                onChange={e => setForwardSearch(e.target.value)}
                placeholder="Search connections..."
                className="w-full bg-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {/* Friends list */}
            <div className="max-h-52 overflow-y-auto">
              {friends
                .filter(f => !f.isGroup && (f.nickname || f.username).toLowerCase().includes(forwardSearch.toLowerCase()))
                .map(f => (
                  <div
                    key={f._id}
                    onClick={() => setForwardTarget(forwardTarget?._id === f._id ? null : f)}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${forwardTarget?._id === f._id ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 overflow-hidden">
                      {f.profileIconUrl ? <img src={f.profileIconUrl} className="w-full h-full object-cover" alt="" /> : (f.nickname || f.username).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-on-surface flex-1 truncate">{f.nickname || f.username}</span>
                    {forwardTarget?._id === f._id && (
                      <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                  </div>
                ))}
            </div>
            {/* Send button */}
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => { setForwardMsg(null); setForwardTarget(null); setForwardSearch(''); }} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-on-surface text-sm font-bold hover:bg-slate-200 transition-colors">Cancel</button>
              <button
                onClick={handleForward}
                disabled={!forwardTarget}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/80 transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Message Context Menu ───────────────────────────────────────── */}
      {msgMenu && (
        <div className="fixed inset-0 z-[90]" onClick={() => setMsgMenu(null)}>
          <div
            className="absolute bg-white rounded-2xl shadow-2xl border border-slate-100 py-1 w-52 overflow-hidden"
            style={{ top: msgMenu.y, left: msgMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            {/* Select */}
            <button onClick={() => toggleSelectMessage(msgMenu.messageId)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-[18px] text-slate-500">check_circle</span>
              Select
            </button>

            {/* Copy — only for text messages */}
            {msgMenu.content && (
              <button
                onClick={() => { navigator.clipboard.writeText(msgMenu.content); setMsgMenu(null); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-slate-500">content_copy</span>
                Copy
              </button>
            )}

            {/* Forward */}
            <button
              onClick={() => { setForwardMsg({ _id: msgMenu.messageId, content: msgMenu.content, attachments: msgMenu.attachments }); setMsgMenu(null); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-slate-500">forward</span>
              Forward
            </button>

            {/* Download — only for media attachments */}
            {msgMenu.attachments?.map((att, i) => {
              if (!att.url || att.url.startsWith('blob:')) return null;
              const extMap = { image: 'jpeg', video: 'mp4', audio: 'mp3' };
              const ext = extMap[att.fileType] || att.fileType;
              return (
                <a key={i} href={att.url} download={`travelbuddy-${att.fileType}-${Date.now()}.${ext}`} target="_blank" rel="noreferrer"
                  onClick={() => setMsgMenu(null)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-slate-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">download</span>
                  Download .{ext}
                </a>
              );
            })}

            <div className="border-t border-slate-100 my-1" />

            {/* Delete */}
            <button
              onClick={() => handleDeleteMessage(msgMenu.messageId)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-error hover:bg-red-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              {msgMenu.isMe ? 'Delete for everyone' : 'Delete for me'}
            </button>
          </div>
        </div>
      )}
      {(isRecording || audioPreviewUrl) && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6">
            <h3 className="font-bold text-lg text-on-surface">
              {isRecording ? 'Recording...' : 'Preview'}
            </h3>

            {/* Animated mic / waveform */}
            {isRecording && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-5xl text-error" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                </div>
                <span className="text-2xl font-mono font-bold text-error">{formatRecordingTime(recordingSeconds)}</span>
              </div>
            )}

            {/* Audio preview after stopping */}
            {!isRecording && audioPreviewUrl && (
              <audio src={audioPreviewUrl} controls className="w-full" />
            )}

            {/* Controls */}
            <div className="flex gap-3 w-full">
              {isRecording ? (
                <>
                  <button
                    onClick={cancelRecording}
                    className="flex-1 py-3 rounded-2xl bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={stopRecording}
                    className="flex-1 py-3 rounded-2xl bg-error text-white font-bold text-sm hover:bg-error/80 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">stop</span>
                    Stop
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={cancelRecording}
                    className="flex-1 py-3 rounded-2xl bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={sendRecordedAudio}
                    disabled={sending}
                    className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <main className="w-full px-6 py-8 flex flex-col md:flex-row gap-8 flex-1 overflow-hidden min-h-0">
        
        {/* Sidebar: Chat List */}
        <aside className="w-full md:w-80 flex flex-col gap-6 overflow-hidden shrink-0">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm shrink-0 relative">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">public</span>
              <input 
                value={searchQuery}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowGlobalResults(true)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-outline" 
                placeholder={t('Find match globally...')} 
                type="text"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setGlobalResults([]); setShowGlobalResults(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Global Search Results Dropdown */}
            {showGlobalResults && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-outline-variant/20 z-[60] max-h-80 overflow-y-auto p-2 scrollbar-hide animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-outline border-b border-outline-variant/10 mb-2">
                  {t('Matching Travelers')}
                </div>
                {isSearchingGlobal ? (
                  <div className="py-8 flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] text-outline font-bold">DISCOVERING...</span>
                  </div>
                ) : globalResults.length === 0 ? (
                  <div className="py-8 text-center">
                    <span className="material-symbols-outlined text-outline opacity-20 text-3xl block mb-2">person_search</span>
                    <span className="text-xs text-outline font-medium">No new travelers found</span>
                  </div>
                ) : (
                  globalResults.map(u => (
                    <div 
                      key={u._id}
                      onClick={() => { setShowGlobalResults(false); navigate(`/profile/${u._id}`); }}
                      className="flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-xl cursor-pointer transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center font-bold text-secondary shrink-0 border border-secondary/20">
                        {u.username?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-on-surface group-hover:text-primary truncate">{u.nickname || u.username}</p>
                        <p className="text-[10px] text-outline truncate">@ {u.username}</p>
                      </div>
                      <span className="material-symbols-outlined text-outline opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward_ios</span>
                    </div>
                  ))
                )}
                <div className="mt-2 pt-2 border-t border-outline-variant/10 text-center">
                  <p className="text-[9px] text-outline font-medium px-4 leading-tight italic">Find users not yet in your connections</p>
                </div>
              </div>
            )}
            {/* Overlay to close dropdown */}
            {showGlobalResults && (
              <div className="fixed inset-0 z-[-1]" onClick={() => setShowGlobalResults(false)} />
            )}
          </div>
          
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm flex flex-col gap-4 overflow-hidden">
            <h2 className="text-xl font-bold font-headline tracking-tight text-primary">{t('Active Connections')}</h2>
            
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input 
                value={connectionSearch}
                onChange={(e) => setConnectionSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-surface-container-low border-none rounded-lg text-xs focus:ring-2 focus:ring-primary/20 placeholder:text-outline" 
                placeholder={t('Search connections...')} 
                type="text"
              />
            </div>
            
            <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide py-1">
              {loadingUsers ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />)}
                </div>
              ) : filteredFriends.filter(f => !f.isGroup).length === 0 ? (
                <div className="text-center text-outline-variant py-4 text-sm">No connections found.</div>
              ) : (
                filteredFriends.filter(f => !f.isGroup).map(friend => {
                  const isOnlineFriend = onlineUsers.has(friend._id);
                  const isSelected = selectedUser?._id === friend._id;
                  
                  return (
                    <div 
                      key={friend._id}
                      onClick={() => setSelectedUser(friend)}
                      className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-primary-fixed' : 'hover:bg-surface-container-low bg-surface-container-lowest'}`}
                    >
                      <div className="relative shrink-0">
                        {friend.profileIconUrl ? (
                          <img alt={friend.nickname || friend.username} className="w-12 h-12 rounded-full object-cover" src={friend.profileIconUrl}/>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold text-lg">
                            {(friend.nickname || friend.username).charAt(0).toUpperCase()}
                          </div>
                        )}
                        {isOnlineFriend && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-surface-container-lowest rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center mb-0.5">
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <span className="font-bold text-sm text-on-surface truncate">{friend.nickname || friend.username}</span>
                            {friend.isVerified && (
                              <span className="material-symbols-outlined text-blue-500 text-[14px] font-bold shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                            )}
                          </div>
                          <span className="text-[10px] text-outline font-medium shrink-0">
                            {isOnlineFriend ? 'Now' : lastSeen[friend._id] ? new Date(lastSeen[friend._id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className={`text-xs truncate ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {typingUsers[friend._id] ? 'typing...' : (isOnlineFriend ? 'Online' : 'Offline')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm shrink-0 overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold font-headline tracking-tight text-primary mb-4">{t('Joined Groups')}</h2>
            <div className="flex flex-col gap-3 overflow-y-auto scrollbar-hide">
              {friends.filter(f => f.isGroup).length === 0 ? (
                <div className="text-center py-2">
                  <p className="text-xs text-outline font-medium italic">No groups joined</p>
                </div>
              ) : (
                friends.filter(f => f.isGroup).map(group => {
                   const isSelected = selectedUser?._id === group._id;
                   return (
                    <div 
                      key={group._id} 
                      onClick={() => setSelectedUser(group)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-secondary-fixed' : 'hover:bg-surface-container-low bg-surface-container-lowest'}`}
                    >
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                         <span className="material-symbols-outlined">groups</span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-xs text-on-surface truncate">{group.nickname}</p>
                        <p className="text-[10px] text-outline truncate">{group.participantsCount} members</p>
                      </div>
                    </div>
                   );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Main Chat Interface */}
        <section className="flex-1 flex flex-col bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden relative min-w-0 min-h-0">
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center text-outline gap-4">
              <span className="material-symbols-outlined text-6xl opacity-30">chat</span>
              <p className="text-lg font-medium">{t('Select a connection to start chatting')}</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-6 bg-surface-container-low flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    {selectedUser.profileIconUrl ? (
                      <img alt={selectedUser.nickname} className="w-14 h-14 rounded-xl object-cover border border-outline-variant/30" src={selectedUser.profileIconUrl}/>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold text-2xl border border-outline-variant/30">
                        {(selectedUser.nickname || selectedUser.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-extrabold font-headline text-primary tracking-tight truncate max-w-[200px] lg:max-w-md">
                        {selectedUser.nickname || selectedUser.username}
                      </h2>
                      {selectedUser.isVerified && (
                        <span className="material-symbols-outlined text-blue-500 text-[20px] font-bold shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {!selectedUser.isGroup && (
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded uppercase tracking-tighter ${selectedUser.isVerified ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-primary/10 text-secondary-container'}`}>
                          {selectedUser.isVerified ? 'Verified Host' : 'Unverified Traveler'}
                        </span>
                      )}
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        {selectedUser.isGroup ? 'Group Trip Chat' : `• ${isOnline ? 'Active Now' : ls ? `Active ${new Date(ls).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Offline'}`}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 relative">
                  <button onClick={() => setShowChatMenu(p => !p)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-outline">
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                  
                  {showChatMenu && (
                    <div className="absolute right-0 top-12 mt-1 w-48 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/20 py-1 z-50">
                      <button onClick={() => { setShowChatMenu(false); navigate(`/profile/${selectedUser._id}`); }} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors">
                        <span className="material-symbols-outlined text-[18px]">person</span> View Profile
                      </button>
                      <button onClick={handleDeleteChat} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-error hover:bg-error-container/30 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">delete</span> Delete Chat
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Message Search Bar */}
              {showMsgSearch && (
                <div className="bg-surface-container-low border-t border-outline-variant/10 px-6 py-3 shrink-0">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                    <input 
                      type="text" value={msgSearch} onChange={e => handleMsgSearch(e.target.value)}
                      placeholder="Search within conversation..."
                      className="w-full pl-9 pr-4 py-2 text-sm border-none rounded-full bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  {msgSearchResults.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                      {msgSearchResults.map(m => (
                        <div key={m._id} className="text-xs bg-surface-container-lowest rounded-lg px-3 py-2 border border-outline-variant/10 text-on-surface flex gap-2 items-start">
                          <span className="text-outline shrink-0">{new Date(m.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                          <span className="line-clamp-2">{m.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Chat Content */}
              <div className={`flex-1 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed scroll-smooth min-h-0 ${selectedUser?.isGroup ? 'p-4 lg:p-6' : 'p-6'}`} style={{opacity: 0.95}}>
                <div className="flex flex-col space-y-6 min-h-full">
                
                {/* Trip Pact — only for group chats, only when pacts exist */}
                {selectedUser.isGroup && selectedUser.tripPacts?.length > 0 && messages.length > 0 && (
                  <div className="bg-tertiary-fixed/40 border-l-4 border-tertiary p-4 rounded-r-xl flex items-start gap-4">
                    <span className="material-symbols-outlined text-tertiary shrink-0">push_pin</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-tertiary mb-2">
                        Trip Pact — {selectedUser.nickname || selectedUser.username}
                      </h4>
                      <div className="space-y-1.5">
                        {selectedUser.tripPacts.map((pact, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-tertiary text-base shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            <span className="text-xs font-medium text-on-surface leading-relaxed">{pact}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {loadingMessages ? (
                  <div className="text-center text-outline py-10 font-medium">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-outline py-10 font-medium">No messages yet. Send a message to start! 👋</div>
                ) : (() => {
                  let lastDateLabel = null;
                  return messages.map((msg, idx) => {
                    const isMe = msg.sender?._id === user.id || msg.sender?._id?.toString() === user.id;
                    const currentDateLabel = formatDateLabel(msg.createdAt);
                    const showDateSeparator = currentDateLabel !== lastDateLabel;
                    lastDateLabel = currentDateLabel;

                    return (
                      <React.Fragment key={msg._id}>
                        {showDateSeparator && (
                          <div className="flex justify-center my-6 sticky top-0 z-20">
                            <div className="bg-surface-container-high/80 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full text-outline border border-outline-variant/10 shadow-sm">
                              {currentDateLabel}
                            </div>
                          </div>
                        )}

                        {msg.type === 'location' ? (
                          <div className="w-full py-2">
                            <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/10 shadow-sm overflow-hidden transition-all duration-300">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-primary">location_on</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-on-surface truncate">{msg.location?.title || msg.title}</p>
                                  <p className="text-[10px] text-outline truncate">{msg.location?.address || msg.address}</p>
                                </div>
                                <button 
                                  onClick={() => {
                                    setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, showMap: !m.showMap } : m));
                                  }}
                                  className="bg-white text-primary text-[10px] font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all outline-none border border-outline-variant/20"
                                >
                                  {msg.showMap ? 'Hide map' : 'See map'}
                                </button>
                              </div>
                              
                              {msg.showMap && (
                                <div className="mt-4 rounded-xl overflow-hidden h-48 bg-slate-200 animate-in fade-in zoom-in-95 duration-300 relative border border-outline-variant/10 z-0">
                                  <MapContainer 
                                    center={[msg.location?.lat || msg.lat || 0, msg.location?.lng || msg.lng || 0]} 
                                    zoom={15} 
                                    minZoom={3}
                                    maxBounds={[[-90, -180], [90, 180]]}
                                    maxBoundsViscosity={1.0}
                                    className="w-full h-full"
                                    zoomControl={false}
                                    scrollWheelZoom={false}
                                    dragging={false}
                                    touchZoom={false}
                                    doubleClickZoom={false}
                                  >
                                    <TileLayer
                                      url="https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=1ayBaS3Kqy7c6TCGvZYN"
                                    />
                                    {(() => {
                                      const center = [msg.location?.lat || msg.lat, msg.location?.lng || msg.lng];
                                      if (center[0] && center[1]) {
                                        return (
                                          <>
                                            <MapUpdater center={center} />
                                            <Marker position={center} />
                                          </>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </MapContainer>
                                  <div className="absolute inset-0 bg-transparent cursor-default pointer-events-none border border-outline-variant/10 rounded-xl"></div>
                                </div>
                              )}

                              <div className="flex justify-end mt-2">
                                <span className="text-[10px] font-medium text-outline">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {isMe && <StatusTicks status={msg.status} />}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/msg items-end gap-2`}
                            onClick={() => { if (selectedMessages.size > 0) toggleSelectMessage(msg._id); }}
                          >
                            {/* Selection checkbox */}
                            {selectedMessages.size > 0 && (
                              <div className={`shrink-0 flex items-center ${isMe ? 'order-first' : 'order-last'}`}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedMessages.has(msg._id) ? 'bg-primary border-primary' : 'border-outline bg-white'}`}>
                                  {selectedMessages.has(msg._id) && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                </div>
                              </div>
                            )}

                            {/* Three-dot button — outside bubble, left for sent / right for received */}
                            {!msg.deleted && !msg.deletedForMe && selectedMessages.size === 0 && (
                              <div className={`shrink-0 opacity-0 group-hover/msg:opacity-100 transition-opacity self-center ${isMe ? 'order-first' : 'order-last'}`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = Math.min(isMe ? rect.left - 210 : rect.right + 4, window.innerWidth - 220);
                                    const y = Math.min(rect.top, window.innerHeight - 260);
                                    setMsgMenu({ messageId: msg._id, x, y, isMe, attachments: msg.attachments || [], content: msg.content || '' });
                                  }}
                                  className="p-1 rounded-full hover:bg-surface-container-high text-outline transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                </button>
                              </div>
                            )}

                            {/* Sender avatar — only for other users' messages in group chats */}
                            {!isMe && selectedUser?.isGroup && (
                              <div className="shrink-0 self-end mb-1">
                                {msg.sender?.profileIconUrl ? (
                                  <img
                                    src={msg.sender.profileIconUrl}
                                    alt={msg.sender.nickname || msg.sender.username}
                                    className="w-7 h-7 rounded-full object-cover border border-outline-variant/20"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-outline-variant/20">
                                    {(msg.sender?.nickname || msg.sender?.username || '?')[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              {/* Sender name — only for other users in group chats */}
                              {!isMe && selectedUser?.isGroup && (
                                <span className="text-[10px] font-bold text-outline mb-1 px-1">
                                  {msg.sender?.nickname || msg.sender?.username || 'Member'}
                                </span>
                              )}

                            <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
                              msg.attachments?.length && !msg.content ? 'w-[280px]' : 'max-w-[96%]'
                            } ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-surface-container-low text-on-surface rounded-tl-none'}
                            ${selectedMessages.has(msg._id) ? 'ring-2 ring-primary ring-offset-1' : ''}`}>

                              {msg.deleted ? (
                                <span className={`italic text-xs ${isMe ? 'text-white/50' : 'text-outline'}`}>
                                  🚫 This message was deleted
                                </span>
                              ) : msg.deletedForMe ? (
                                <span className="italic text-xs text-outline">
                                  🗑 You deleted this message
                                </span>
                              ) : (
                                <>
                                  {msg.attachments?.map((att, i) => (
                                    <div key={i} className="mb-3">
                                      {att.fileType === 'image' && <img src={att.url} alt="attachment" className="rounded-xl w-full max-h-64 object-cover" />}
                                      {att.fileType === 'video' && (
                                        <div className="relative group cursor-pointer" onClick={() => setLightboxUrl(att.url)}>
                                          <video src={att.url} className="rounded-xl w-full min-h-[160px] max-h-64 bg-black object-contain pointer-events-none" preload="metadata" />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                                            <span className="material-symbols-outlined text-white text-5xl drop-shadow-lg group-hover:scale-110 transition-transform" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                                          </div>
                                        </div>
                                      )}
                                      {att.fileType === 'audio' && (
                                        <audio src={att.url} controls className="w-full min-w-[260px]" style={{ minWidth: '260px' }} />
                                      )}
                                    </div>
                                  ))}
                                  {msg.content && <div>{msg.content}</div>}
                                </>
                              )}

                              <div className={`flex items-center gap-1 mt-2 text-[10px] font-medium ${isMe ? 'text-primary-fixed opacity-80 justify-end' : 'text-outline justify-end'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isMe && !msg.deleted && <StatusTicks status={msg.status} />}
                              </div>
                            </div>
                            </div>{/* close flex-col sender name + bubble wrapper */}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
              
                


                {typingUsers[selectedUser._id] && (
                  <div className="flex justify-start">
                    <div className="bg-surface-container-low px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                      {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                    </div>
                  </div>
                )}
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* Selection toolbar */}
              {selectedMessages.size > 0 && (
                <div className="bg-surface-container-lowest border-t border-outline-variant/10 px-6 py-3 flex items-center justify-between shrink-0">
                  <span className="font-bold text-sm text-on-surface">{selectedMessages.size} selected</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        const ids = [...selectedMessages];
                        await Promise.all(ids.map(id => handleDeleteMessage(id)));
                        clearSelection();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-error text-white text-sm font-bold hover:bg-error/80 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Delete
                    </button>
                    <button
                      onClick={clearSelection}
                      className="flex items-center gap-1 px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm font-bold hover:bg-surface-container-high active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Media preview */}
              {mediaFile && (
                <div className="bg-surface-container-lowest border-t border-outline-variant/10 px-6 py-3 flex items-center gap-4 shrink-0">
                  <div className="relative">
                    {mediaFileType === 'image' && (
                      <img src={mediaPreview} alt="preview" className="h-16 w-16 object-cover rounded-xl border border-outline-variant/20 shadow-sm" />
                    )}
                    {mediaFileType === 'video' && (
                      <div className="relative h-16 w-24 rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden bg-black">
                        <video src={mediaPreview} className="h-full w-full object-cover" muted />
                        {sending && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    )}
                    {mediaFileType === 'audio' && (
                      <div className="h-16 w-24 rounded-xl border border-outline-variant/20 shadow-sm bg-surface-container-low flex items-center justify-center relative">
                        <span className="material-symbols-outlined text-3xl text-primary">audio_file</span>
                        {sending && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    )}
                    {!sending && (
                      <button onClick={() => { setMediaFile(null); setMediaPreview(null); setMediaFileType('image'); }} className="absolute -top-2 -right-2 bg-error text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    )}
                  </div>
                  <span className="text-sm font-medium text-outline truncate max-w-[200px]">
                    {sending ? 'Uploading...' : `Attached: ${mediaFile.name}`}
                  </span>
                </div>
              )}

              {/* Message Input */}
              <form onSubmit={handleSend} className="p-6 bg-surface-container-lowest flex items-center gap-4 shrink-0 border-t border-outline-variant/10 relative">
                <div className="relative">
                  <button 
                    type="button" 
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} 
                    className={`p-2 transition-colors rounded-full ${showAttachmentMenu ? 'bg-primary text-white' : 'text-outline bg-surface-container-low hover:bg-surface-container-high'}`}
                  >
                    <span className="material-symbols-outlined">link</span>
                  </button>

                  {showAttachmentMenu && (
                    <div className="absolute bottom-14 left-0 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/20 py-2 w-44 z-50 animate-in fade-in slide-in-from-bottom-2">
                      <button 
                        type="button"
                        onClick={() => { setShowAttachmentMenu(false); fileInputRef.current?.click(); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px] text-primary">image</span>
                        Image
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setShowAttachmentMenu(false); videoInputRef.current?.click(); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px] text-secondary">videocam</span>
                        Video
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setShowAttachmentMenu(false); startRecording(); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px] text-tertiary">mic</span>
                        Record Audio
                      </button>
                      <button 
                        type="button"
                        onClick={sendLocation}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px] text-error">map</span>
                        Location
                      </button>
                    </div>
                  )}
                </div>

                {/* Hidden file inputs — one per media type */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); setMediaFileType('image'); }
                    e.target.value = '';
                  }}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); setMediaFileType('video'); }
                    e.target.value = '';
                  }}
                />
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); setMediaFileType('audio'); }
                    e.target.value = '';
                  }}
                />
                
                <div className="flex-1 relative">
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (newMessage.trim() || mediaFile) handleSend(e);
                      }
                    }}
                    placeholder={t('Type a secure message...')}
                    className="w-full bg-surface-container-low border-none rounded-3xl px-6 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-outline resize-none overflow-hidden leading-relaxed"
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                    onInput={e => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={(!newMessage.trim() && !mediaFile) || sending}
                  className="bg-blue-600 hover:bg-blue-700 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  <span className="material-symbols-outlined pr-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                </button>
              </form>
            </>
          )}
        </section>

        {/* Right Panel: Contextual Quality & Safety — hidden for group chats */}
        {selectedUser && !selectedUser.isGroup && (
          <aside className="hidden lg:flex w-96 flex-col gap-6 shrink-0 z-10 overflow-y-auto scrollbar-hide pb-20">
            {matchScore && (
              <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10">
                <h3 className="text-lg font-bold font-headline text-primary mb-4 tracking-tight">Match Quality</h3>
                <div className="flex items-center justify-center relative mb-6">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle className="text-surface-container-low" cx="64" cy="64" fill="transparent" r="60" stroke="currentColor" strokeWidth="8"></circle>
                    <circle className="text-primary" cx="64" cy="64" fill="transparent" r="60" stroke="currentColor" strokeDasharray="376.99" strokeDashoffset={376.99 - (376.99 * matchScore.score) / 100} strokeWidth="8" style={{transition: 'stroke-dashoffset 1s ease-in-out'}}></circle>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-black text-primary font-headline">{matchScore.score}%</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-outline">Match</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {matchScore.sharedSignals?.map((signal, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-green-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span className="text-xs text-on-surface-variant font-medium">{signal}</span>
                    </div>
                  ))}
                  {matchScore.sharedSignals?.length === 0 && (
                    <div className="text-xs text-on-surface-variant italic">No major shared preferences found.</div>
                  )}
                </div>
              </div>
            )}

            {/* Safety warning — only for direct (non-group) chats with unverified users */}
            {!selectedUser.isGroup && !selectedUser.isVerified && (
              <div className="bg-error-container/30 border border-error/20 rounded-xl p-6 shadow-sm animate-pulse">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-error mt-0.5">warning</span>
                  <div>
                    <h3 className="text-sm font-bold text-error mb-1">Safety Warning</h3>
                    <p className="text-xs text-on-error-container leading-relaxed">
                      {selectedUser.nickname || selectedUser.username} is an unverified user. We recommend you to prioritize your safety and only communicate through our secure platform.
                    </p>
                    <button className="mt-3 text-[10px] font-bold text-error hover:underline transition-all">Learn more about safety</button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-surface-container-lowest glass-nav border-t border-outline-variant/30 flex justify-around py-3 z-50 safe-area-bottom px-4">
        <button onClick={() => navigate('/homepage')} className="flex flex-col items-center gap-1 text-on-surface-variant transition-colors hover:text-primary">
          <span className="material-symbols-outlined text-2xl">home</span>
          <span className="text-[10px] font-bold">{t('Home')}</span>
        </button>
        <button onClick={() => navigate('/browsepage')} className="flex flex-col items-center gap-1 text-on-surface-variant transition-colors hover:text-primary">
          <span className="material-symbols-outlined text-2xl">explore</span>
          <span className="text-[10px] font-medium">{t('Explore')}</span>
        </button>
        <button onClick={() => navigate('/chatpage')} className="flex flex-col items-center gap-1 text-primary transition-colors hover:text-primary">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
          <span className="text-[10px] font-medium">{t('Chat')}</span>
        </button>
        <button onClick={() => navigate('/itineraryplanningpage')} className="flex flex-col items-center gap-1 text-on-surface-variant transition-colors hover:text-primary">
          <span className="material-symbols-outlined text-2xl">map</span>
          <span className="text-[10px] font-medium">{t('Trips')}</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-on-surface-variant transition-colors hover:text-primary">
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="text-[10px] font-medium">{t('Profile')}</span>
        </button>
      </nav>

      {/* Location Picker Modal */}
      {isLocationPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsLocationPickerOpen(false)}></div>
          <div className="bg-surface-container-lowest w-full max-w-5xl rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col h-[85vh] max-h-[95vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest relative z-20">
              <div>
                <h3 className="text-xl font-black font-headline text-primary tracking-tight">Select Location</h3>
                <p className="text-xs text-outline font-medium mt-0.5">Find a point to share with your traveler</p>
              </div>
              <button onClick={() => setIsLocationPickerOpen(false)} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
                <span className="material-symbols-outlined text-outline">close</span>
              </button>
            </div>

            {/* Main Content: 2 Columns */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* Left Column: Search, Results & Share */}
              <div className="w-full md:w-[360px] flex flex-col border-r border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
                <div className="p-6 flex flex-col h-full overflow-hidden">
                  {/* Search Bar */}
                  <form onSubmit={handleLocationSearch} className="relative mb-6">
                    <input 
                      autoFocus
                      value={locationSearchQuery}
                      onChange={(e) => setLocationSearchQuery(e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-2xl pl-10 pr-16 py-3.5 text-xs focus:ring-2 focus:ring-primary/20 placeholder:text-outline/60 font-medium" 
                      placeholder="Search landmarks..." 
                      type="text"
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary opacity-70 text-lg">search</span>
                    <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-bold px-3 py-2 rounded-xl hover:bg-primary/90 transition-colors">
                      {isSearchingLoc ? '...' : 'Go'}
                    </button>
                  </form>

                  {/* Results List */}
                  <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide mb-4">
                    {locationResults.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-outline/50 px-1 mb-1">Search Results</h4>
                        {locationResults.map(loc => (
                          <div 
                            key={loc.id} 
                            onClick={() => setTempSelectedLoc(loc)}
                            className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all border-2 ${tempSelectedLoc?.id === loc.id ? 'bg-primary/5 border-primary shadow-sm' : 'hover:bg-surface-container-low border-transparent'}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${tempSelectedLoc?.id === loc.id ? 'bg-primary text-white' : 'bg-surface-container-low text-primary'}`}>
                              <span className="material-symbols-outlined text-sm">place</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-on-surface truncate leading-tight mb-0.5">{loc.title}</p>
                              <p className="text-[9px] text-outline font-medium line-clamp-2 leading-relaxed">{loc.address}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : locationSearchQuery && !isSearchingLoc ? (
                      <div className="text-center py-6 text-outline/60 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30 flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-xl opacity-30">search_off</span>
                        <p className="text-[11px] font-bold">No locations found</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-outline/30 gap-3 opacity-60">
                        <span className="material-symbols-outlined text-3xl">map</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-center">Enter a location<br/>to begin</p>
                      </div>
                    )}
                  </div>

                  {/* Share Button (now in the left column) */}
                  <button 
                    disabled={!tempSelectedLoc}
                    onClick={confirmLocation}
                    className={`w-full py-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 mb-2 ${
                      tempSelectedLoc 
                        ? 'cta-gradient text-white shadow-xl shadow-orange-900/20 active:scale-[0.98]' 
                        : 'bg-surface-container-high text-outline/40 cursor-not-allowed grayscale'
                    }`}
                  >
                    {tempSelectedLoc && <span className="material-symbols-outlined text-sm animate-in zoom-in duration-300">send</span>}
                    {tempSelectedLoc ? `Share with ${selectedUser?.nickname || 'Traveler'}` : 'Select a location'}
                  </button>
                </div>
              </div>

              {/* Right Column: Full-Height Map */}
              <div className="flex-1 bg-surface-container-low relative z-10 flex flex-col">
                <div className="flex-1 relative">
                  <MapContainer 
                    center={tempSelectedLoc ? [tempSelectedLoc.lat, tempSelectedLoc.lng] : [20, 0]} 
                    zoom={tempSelectedLoc ? 14 : 3} 
                    minZoom={3}
                    maxBounds={[[-90, -180], [90, 180]]}
                    maxBoundsViscosity={1.0}
                    className="w-full h-full"
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=1ayBaS3Kqy7c6TCGvZYN"
                      attribution='&copy; MapTiler'
                    />
                    {tempSelectedLoc && (
                      <>
                        <MapUpdater center={[tempSelectedLoc.lat, tempSelectedLoc.lng]} />
                        <Marker position={[tempSelectedLoc.lat, tempSelectedLoc.lng]} />
                      </>
                    )}
                  </MapContainer>
                  
                  {/* Map Controls / Labels */}
                  {tempSelectedLoc && (
                    <div className="absolute bottom-6 left-6 z-[1000] animate-in slide-in-from-bottom-4 duration-500">
                      <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-outline-variant/10 flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary">location_on</span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-on-surface uppercase tracking-tight">{tempSelectedLoc.title}</p>
                          <p className="text-[9px] text-outline font-medium line-clamp-1 max-w-[200px]">{tempSelectedLoc.address}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
