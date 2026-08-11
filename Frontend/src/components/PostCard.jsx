// src/components/PostCard.jsx
export default function PostCard({ post, onCommentClick, onLikeClick }) {
  const timeAgo = (date) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const likeCount = post.likeCount || 0;
  const commentCount = post.commentCount || 0;

  return (
    <article className="bg-surface-container-lowest rounded-[2rem] shadow-sm border border-outline-variant/10 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 font-body group">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-outline-variant/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary overflow-hidden border border-primary/5">
            {post.user?.profileIconUrl ? (
              <img src={post.user.profileIconUrl} alt="avatar" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            )}
          </div>
          <div>
            <div className="font-headline font-bold text-on-surface text-base group-hover:text-primary transition-colors">
              {post.user?.username || 'Traveler'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/70 font-medium">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              {timeAgo(post.createdAt)}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {post.user?.isVerified && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-sm animate-in fade-in zoom-in duration-300">
              <span className="material-symbols-outlined text-[16px] font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Verified Traveller</span>
            </div>
          )}
          {post.destination && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-container/30 rounded-full text-secondary font-bold text-[10px] uppercase tracking-wider">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
              {post.destination}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {post.title && (
          <h2 className="font-headline font-black text-2xl text-on-surface mb-3 tracking-tight leading-tight">
            {post.title}
          </h2>
        )}
        <p className="text-on-surface-variant whitespace-pre-line leading-relaxed text-sm md:text-base mb-5">
          {post.content}
        </p>

        {post.image && (
          <div className="rounded-[1.5rem] overflow-hidden border border-outline-variant/20 shadow-inner group/image relative mb-4">
            {post.mediaType === 'video' ? (
              <video
                src={post.image.startsWith('http') ? post.image : `${import.meta.env.VITE_API_URL}${post.image}`}
                controls
                className="w-full max-h-[600px] bg-black"
                preload="metadata"
              />
            ) : (
              <>
                <img
                  src={post.image.startsWith('http') ? post.image : `${import.meta.env.VITE_API_URL}${post.image}`}
                  alt={post.title || 'Travel photo'}
                  className="w-full object-cover max-h-[600px] transition-transform duration-700 group-hover/image:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity" />
              </>
            )}
          </div>
        )}
        
        {post.activities && post.activities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.activities.map((activity, idx) => (
              <span key={idx} className="px-3 py-1 bg-surface-container text-on-surface-variant text-xs font-bold rounded-full">
                {activity}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-surface-container-low/30 border-t border-outline-variant/5 flex justify-between items-center">
        <div className="flex gap-4">
          <button 
            onClick={() => onLikeClick && onLikeClick(post._id)}
            className={`flex items-center gap-2 transition-all active:scale-95 ${post.isLiked ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: post.isLiked ? "'FILL' 1" : "" }}>favorite</span>
            <span className="text-xs font-bold">{likeCount}</span>
          </button>
          <button 
            onClick={() => onCommentClick && onCommentClick(post._id)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
            <span className="text-xs font-bold">{commentCount}</span>
          </button>
        </div>
        
        <button 
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: post.title || 'Travel Post',
                text: 'Check out this post on TravelBuddy!',
                url: window.location.href,
              }).catch(console.error);
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copied to clipboard!');
            }
          }}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">share</span>
        </button>
      </div>
    </article>
  );
}