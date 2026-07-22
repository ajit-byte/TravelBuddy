import { useState, useEffect, useContext, useRef } from 'react';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getFeed, createPost, likePost, commentPost, deletePost, uploadPostMedia as uploadMedia, uploadPostMusic as uploadMusic, getMusicLibrary } from '../api/socialApi';

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ profile, size = 10 }) {
  const initial = (profile?.nickname || profile?.username || '?')[0].toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0"
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
    >
      {profile?.profileIconUrl
        ? <img src={profile.profileIconUrl} alt="" className="w-full h-full object-cover" />
        : <span className="text-sm">{initial}</span>}
    </div>
  );
}

const GENRES = ['All', 'Chill', 'Epic', 'Electronic', 'Ambient', 'Pop', 'Rock', 'Reggae', 'Jazz', 'Blues', 'Lofi', 'Indie', 'World'];

// ── Post Composer ────────────────────────────────────────────────────────────
function PostComposer({ profile, onPosted }) {
  const { showToast } = useToast();

  const [content, setContent]           = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [mediaFile, setMediaFile]       = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType]       = useState(''); // 'image' | 'video'
  const [selectedMusic, setSelectedMusic] = useState(null); // { url, name, artist }
  const [videoMuted, setVideoMuted]     = useState(false);
  const [posting, setPosting]           = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [activePanel, setActivePanel]   = useState(null); // 'tags' | 'music'

  // Music library state
  const [musicLibrary, setMusicLibrary] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicSearch, setMusicSearch]   = useState('');
  const [musicGenre, setMusicGenre]     = useState('All');
  const [previewTrack, setPreviewTrack] = useState(null); // track being previewed
  const previewAudioRef = useRef(null);

  const mediaInputRef = useRef();

  // Load music library when panel opens
  useEffect(() => {
    if (activePanel !== 'music') return;
    const load = async () => {
      setMusicLoading(true);
      try {
        const data = await getMusicLibrary(musicGenre === 'All' ? '' : musicGenre, musicSearch);
        setMusicLibrary(data);
      } catch { /* silent */ }
      finally { setMusicLoading(false); }
    };
    load();
  }, [activePanel, musicGenre, musicSearch]);

  const handleMediaPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) { showToast('Only images and videos allowed', 'error'); return; }
    if (file.size > 100 * 1024 * 1024) { showToast('File must be under 100 MB', 'error'); return; }
    // Revoke old preview URL
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMediaType(isVideo ? 'video' : 'image');
    e.target.value = '';
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null); setMediaPreview(''); setMediaType(''); setVideoMuted(false);
  };

  const togglePreview = (track) => {
    if (previewTrack?.id === track.id) {
      previewAudioRef.current?.pause();
      setPreviewTrack(null);
    } else {
      setPreviewTrack(track);
      setTimeout(() => previewAudioRef.current?.play().catch(() => {}), 100);
    }
  };

  const selectTrack = (track) => {
    setSelectedMusic({ url: track.url, name: track.name, artist: track.artist });
    setActivePanel(null);
    if (previewAudioRef.current) { previewAudioRef.current.pause(); setPreviewTrack(null); }
    showToast(`Added "${track.name}"`, 'success');
  };

  const handlePost = async () => {
    if (!content.trim() && !mediaFile) { showToast('Write something or add media', 'error'); return; }
    setPosting(true);
    try {
      let mediaUrl = '', finalMediaType = '';
      if (mediaFile) {
        setUploadingMedia(true);
        const result = await uploadMedia(mediaFile);
        mediaUrl = result.url;
        finalMediaType = result.mediaType;
        setUploadingMedia(false);
      }

      const fromInput = hashtagInput.split(/[\s,]+/).map(t => t.replace(/^#/, '').toLowerCase().trim()).filter(Boolean);
      const fromContent = (content.match(/#(\w+)/g) || []).map(t => t.replace('#', '').toLowerCase());
      const hashtags = [...new Set([...fromInput, ...fromContent])];

      const post = await createPost({
        content: content.trim(), mediaUrl, mediaType: finalMediaType, hashtags,
        musicUrl: selectedMusic?.url || '', musicName: selectedMusic ? `${selectedMusic.name} - ${selectedMusic.artist}` : '',
        videoMuted,
      });

      onPosted(post);
      setContent(''); setHashtagInput(''); clearMedia(); setSelectedMusic(null);
      setVideoMuted(false); setActivePanel(null);
      showToast('Posted!', 'success');
    } catch (err) {
      setUploadingMedia(false);
      showToast(err.message || 'Failed to post', 'error');
    } finally { setPosting(false); }
  };

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10 mb-8">
      <div className="flex gap-3 items-start">
        <Avatar profile={profile} size={10} />
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Share your travel story..."
            rows={3}
            className="w-full bg-surface-container-low rounded-2xl px-4 py-3 text-on-surface placeholder:text-outline-variant resize-none outline-none focus:ring-2 focus:ring-primary/20 text-sm"
          />

          {/* Media preview */}
          {mediaPreview && (
            <div className="relative mt-3 rounded-2xl overflow-hidden bg-black">
              {mediaType === 'video'
                ? <video key={mediaPreview} src={mediaPreview} className="w-full max-h-64 object-contain" controls muted={videoMuted} />
                : <img src={mediaPreview} alt="preview" className="w-full max-h-64 object-cover" />
              }
              <button onClick={clearMedia} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {/* Video mute toggle */}
          {mediaType === 'video' && (
            <label className="mt-2 flex items-center gap-2 cursor-pointer w-fit">
              <div className="relative">
                <input type="checkbox" checked={videoMuted} onChange={e => setVideoMuted(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-surface-container-high rounded-full peer peer-checked:bg-primary transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <span className="text-xs font-bold text-on-surface-variant">
                {videoMuted ? '🔇 Original audio muted' : '🔊 Original audio on'}
              </span>
            </label>
          )}

          {/* Selected music bar */}
          {selectedMusic && (
            <div className="mt-3 flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-2xl px-4 py-2.5">
              <span className="material-symbols-outlined text-primary text-xl">music_note</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-primary truncate">{selectedMusic.name}</p>
                <p className="text-[10px] text-outline">{selectedMusic.artist}</p>
              </div>
              <button onClick={() => setSelectedMusic(null)} className="text-outline hover:text-error shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {/* Hashtag panel */}
          {activePanel === 'tags' && (
            <div className="mt-3">
              <input
                value={hashtagInput}
                onChange={e => setHashtagInput(e.target.value)}
                placeholder="#travel #adventure #beach"
                className="w-full bg-surface-container-low rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline-variant outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-outline mt-1">Space or comma separated. # optional.</p>
            </div>
          )}

          {/* Music Library Panel */}
          {activePanel === 'music' && (
            <div className="mt-3 bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/10">
              <div className="p-3 border-b border-outline-variant/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-base">library_music</span>
                  <span className="font-bold text-sm text-on-surface">Music Library</span>
                  <button onClick={() => setActivePanel(null)} className="ml-auto text-outline hover:text-on-surface">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
                {/* Search */}
                <input
                  value={musicSearch}
                  onChange={e => setMusicSearch(e.target.value)}
                  placeholder="Search tracks..."
                  className="w-full bg-surface-container-lowest rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20 mb-2"
                />
                {/* Genre chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {GENRES.map(g => (
                    <button
                      key={g}
                      onClick={() => setMusicGenre(g)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${musicGenre === g ? 'bg-primary text-white' : 'bg-surface-container-lowest text-outline hover:text-primary'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Track list */}
              <div className="max-h-64 overflow-y-auto">
                {musicLoading ? (
                  <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : musicLibrary.length === 0 ? (
                  <p className="text-xs text-outline text-center py-6">No tracks found</p>
                ) : (
                  musicLibrary.map(track => {
                    const isSelected = selectedMusic?.url === track.url;
                    const isPreviewing = previewTrack?.id === track.id;
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-container-lowest transition-colors border-b border-outline-variant/5 ${isSelected ? 'bg-primary/5' : ''}`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-lg shrink-0">
                          {track.cover}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-on-surface truncate">{track.name}</p>
                          <p className="text-[10px] text-outline">{track.artist} · {track.duration} · {track.genre}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Preview button */}
                          <button
                            onClick={() => togglePreview(track)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isPreviewing ? 'bg-primary/20 text-primary' : 'text-outline hover:text-primary'}`}
                          >
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {isPreviewing ? 'pause' : 'play_arrow'}
                            </span>
                          </button>
                          {/* Select button */}
                          <button
                            onClick={() => selectTrack(track)}
                            className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all ${isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
                          >
                            {isSelected ? 'Selected' : 'Use'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Hidden preview audio */}
              <audio
                ref={previewAudioRef}
                src={previewTrack?.url}
                onEnded={() => setPreviewTrack(null)}
                className="hidden"
              />
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => mediaInputRef.current?.click()}
                disabled={posting}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${mediaFile ? 'bg-primary/10 text-primary' : 'text-outline hover:text-primary hover:bg-primary/5'}`}
                title="Photo / Video"
              >
                <span className="material-symbols-outlined text-base">perm_media</span>
                <span className="hidden sm:inline">{mediaFile ? (mediaType === 'video' ? 'Video' : 'Photo') : 'Media'}</span>
              </button>

              <button
                onClick={() => setActivePanel(p => p === 'music' ? null : 'music')}
                disabled={posting}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${selectedMusic || activePanel === 'music' ? 'bg-primary/10 text-primary' : 'text-outline hover:text-primary hover:bg-primary/5'}`}
                title="Add music"
              >
                <span className="material-symbols-outlined text-base">music_note</span>
                <span className="hidden sm:inline">Music</span>
              </button>

              <button
                onClick={() => setActivePanel(p => p === 'tags' ? null : 'tags')}
                disabled={posting}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${activePanel === 'tags' ? 'bg-primary/10 text-primary' : 'text-outline hover:text-primary hover:bg-primary/5'}`}
                title="Tags"
              >
                <span className="material-symbols-outlined text-base">tag</span>
                <span className="hidden sm:inline">Tags</span>
              </button>
            </div>

            <button
              onClick={handlePost}
              disabled={posting || (!content.trim() && !mediaFile)}
              className="bg-primary text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2"
            >
              {uploadingMedia
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Uploading...</>
                : posting ? 'Posting...' : 'Post'}
            </button>
          </div>

          <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaPick} />
        </div>
      </div>
    </div>
  );
}

// ── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, userId, onLike, onComment, onDelete }) {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const audioRef = useRef(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  const isOwn = post.author?._id?.toString() === userId?.toString();
  const likeCount = post.likes?.length ?? 0;
  const liked = post._liked ?? post.likes?.some(id =>
    (id?._id || id)?.toString() === userId?.toString()
  );

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (musicPlaying) { audioRef.current.pause(); setMusicPlaying(false); }
    else { audioRef.current.play(); setMusicPlaying(true); }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setCommenting(true);
    await onComment(post._id, commentText.trim());
    setCommentText('');
    setCommenting(false);
  };

  return (
    <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 pb-3">
        <Avatar profile={post.author} size={10} />
        <div className="flex-1">
          <p className="font-bold text-on-surface text-sm">{post.author?.nickname || post.author?.username}</p>
          <p className="text-xs text-outline">{timeAgo(post.createdAt)}</p>
        </div>
        {isOwn && (
          <button onClick={() => onDelete(post._id)} className="text-outline hover:text-error transition-colors p-1">
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        )}
      </div>

      {/* Text content */}
      {post.content && (
        <p className="px-5 pb-3 text-on-surface text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
      )}

      {/* Hashtags */}
      {post.hashtags?.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {post.hashtags.map(tag => (
            <span key={tag} className="text-xs text-primary font-bold bg-primary/8 px-2 py-0.5 rounded-full">#{tag}</span>
          ))}
        </div>
      )}

      {/* Media */}
      {post.mediaUrl && post.mediaType === 'image' && (
        <img
          src={post.mediaUrl}
          alt="post media"
          className="w-full object-cover max-h-96"
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
      {post.mediaUrl && post.mediaType === 'video' && (
        <div className="relative bg-black">
          <video
            src={post.mediaUrl}
            className="w-full max-h-96 object-contain"
            controls
            muted={post.videoMuted}
          />
        </div>
      )}

      {/* Music bar */}
      {post.musicUrl && (
        <div className="mx-4 my-3 flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-2xl px-4 py-2.5">
          <button
            onClick={toggleMusic}
            className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              {musicPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary truncate">{post.musicName || 'Audio track'}</p>
            <p className="text-[10px] text-outline">Added music</p>
          </div>
          <span className="material-symbols-outlined text-primary/40 text-lg">music_note</span>
          <audio
            ref={audioRef}
            src={post.musicUrl}
            onEnded={() => setMusicPlaying(false)}
            className="hidden"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-5 px-5 py-3 border-t border-outline-variant/10">
        <button
          onClick={() => onLike(post._id)}
          className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${liked ? 'text-error' : 'text-outline hover:text-error'}`}
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: liked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
          {likeCount}
        </button>
        <button
          onClick={() => setShowComments(p => !p)}
          className="flex items-center gap-1.5 text-sm font-bold text-outline hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-xl">chat_bubble</span>
          {post.comments?.length ?? 0}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="px-5 pb-5 space-y-3 border-t border-outline-variant/10 pt-3">
          {post.comments?.length === 0 && (
            <p className="text-xs text-outline text-center py-2">No comments yet</p>
          )}
          {post.comments?.map((c, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Avatar profile={c.author} size={7} />
              <div className="bg-surface-container-low rounded-2xl px-3 py-2 flex-1">
                <span className="text-xs font-bold text-primary mr-1">{c.author?.nickname || c.author?.username}</span>
                <span className="text-xs text-on-surface">{c.text}</span>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleComment()}
              placeholder="Write a comment..."
              className="flex-1 bg-surface-container-low rounded-full px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={handleComment}
              disabled={commenting}
              className="bg-primary text-white rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, profile } = useContext(AuthContext);
  const { showToast } = useToast();

  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTag, setActiveTag]   = useState('');

  const loadFeed = async (p = 1, replace = false, tag = activeTag) => {
    try {
      if (p === 1) setLoading(true); else setLoadingMore(true);
      const data = await getFeed(p, tag);
      setPosts(prev => replace ? data.posts : [...prev, ...data.posts]);
      setHasMore(p < data.pages);
      setPage(p);
    } catch { showToast('Failed to load feed', 'error'); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => { loadFeed(1, true); }, []);

  const handlePosted = (post) => setPosts(prev => [post, ...prev]);

  const handleLike = async (postId) => {
    try {
      const data = await likePost(postId);
      setPosts(prev => prev.map(p =>
        p._id === postId ? { ...p, likes: Array(data.likes).fill(null), _liked: data.liked } : p
      ));
    } catch { showToast('Failed to like', 'error'); }
  };

  const handleComment = async (postId, text) => {
    try {
      const updated = await commentPost(postId, text);
      setPosts(prev => prev.map(p => p._id === postId ? updated : p));
    } catch { showToast('Failed to comment', 'error'); }
  };

  const handleDelete = async (postId) => {
    try {
      await deletePost(postId);
      setPosts(prev => prev.filter(p => p._id !== postId));
      showToast('Post deleted', 'success');
    } catch { showToast('Failed to delete', 'error'); }
  };

  const filterByTag = (tag) => {
    const next = activeTag === tag ? '' : tag;
    setActiveTag(next);
    loadFeed(1, true, next);
  };

  // Collect unique hashtags from loaded posts for quick filter chips
  const trendingTags = [...new Set(posts.flatMap(p => p.hashtags || []))].slice(0, 8);

  return (
    <div className="min-h-screen bg-surface pt-20 pb-20 md:pb-0">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Composer */}
        <PostComposer profile={profile} onPosted={handlePosted} />

        {/* Trending tag chips */}
        {trendingTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 -mt-3">
            {trendingTags.map(tag => (
              <button
                key={tag}
                onClick={() => filterByTag(tag)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${activeTag === tag ? 'bg-primary text-white' : 'bg-surface-container-low text-outline hover:text-primary hover:bg-primary/10'}`}
              >
                #{tag}
              </button>
            ))}
            {activeTag && (
              <button onClick={() => filterByTag('')} className="text-xs font-bold px-3 py-1.5 rounded-full bg-error/10 text-error">
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-outline mb-3 block">explore</span>
            <p className="text-on-surface-variant font-medium">
              {activeTag ? `No posts with #${activeTag}` : 'No posts yet. Be the first to share!'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map(post => (
              <PostCard
                key={post._id}
                post={post}
                userId={user?.id}
                onLike={handleLike}
                onComment={handleComment}
                onDelete={handleDelete}
              />
            ))}
            {hasMore && (
              <div className="text-center pt-4 pb-8">
                <button
                  onClick={() => loadFeed(page + 1)}
                  disabled={loadingMore}
                  className="text-primary font-bold text-sm hover:underline disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
