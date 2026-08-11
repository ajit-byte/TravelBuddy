import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

export default function CommentsModal({ postId, onClose, onCommentAdded }) {
  const { showToast } = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [collapsedReplies, setCollapsedReplies] = useState({});

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments`);
      if (!res.ok) throw new Error('Failed to load comments');
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error(err);
      showToast('Could not load comments', 'error');
    } finally {
      setLoading(false);
    }
  }, [postId, showToast]);

  useEffect(() => {
    if (postId) fetchComments();
  }, [postId, fetchComments]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setPosting(true);
      const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
      
      if (replyingTo) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments/${replyingTo.id}/reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token || '',
          },
          body: JSON.stringify({ text: newComment }),
        });

        if (!res.ok) throw new Error('Failed to post reply');
        const updatedComment = await res.json();
        
        setComments(comments.map(c => c._id === updatedComment._id ? updatedComment : c));
        setCollapsedReplies(prev => ({ ...prev, [updatedComment._id]: false }));
      } else {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token || '',
          },
          body: JSON.stringify({ text: newComment }),
        });

        if (!res.ok) throw new Error('Failed to post comment');
        const postedComment = await res.json();
        setComments([postedComment, ...comments]);
        if (onCommentAdded) onCommentAdded(postId);
      }
      
      setNewComment('');
      setReplyingTo(null);
    } catch (err) {
      showToast(replyingTo ? 'Error posting reply' : 'Error posting comment', 'error');
    } finally {
      setPosting(false);
    }
  };

  const toggleReplies = (commentId) => {
    setCollapsedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  if (!postId) return null;

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl h-[80vh] bg-surface rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
            <h2 className="text-xl font-headline font-bold text-on-surface">Comments</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-outline">
              <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
              <p className="font-medium animate-pulse">Gathering stories...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-outline py-12">
               <span className="material-symbols-outlined text-6xl opacity-20">forum</span>
               <div>
                  <h3 className="text-on-surface font-bold text-lg">No comments yet</h3>
                  <p className="text-sm max-w-[250px]">Be the first to share your thoughts on this journey!</p>
               </div>
            </div>
          ) : (
            comments.map((comment, idx) => (
              <div key={comment._id || idx} className="flex flex-col gap-2 group animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-surface-container overflow-hidden border border-outline-variant/30 flex items-center justify-center">
                     {comment.user?.profileIconUrl ? (
                       <img src={comment.user.profileIconUrl} alt={comment.user.username} className="w-full h-full object-cover" />
                     ) : (
                       <span className="material-symbols-outlined text-on-surface/30">person</span>
                     )}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-on-surface truncate">{comment.user?.nickname || comment.user?.username || 'Traveler'}</span>
                        <span className="text-[10px] text-outline font-medium uppercase tracking-wider">
                          {new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                     </div>
                     <div className="bg-surface-container-low rounded-2xl rounded-tl-none p-4 border border-outline-variant/10">
                        <p className="text-sm text-on-surface-variant leading-relaxed">{comment.text}</p>
                     </div>
                     <div className="flex items-center gap-4 mt-2 px-2">
                       <button 
                         onClick={() => setReplyingTo({ id: comment._id, name: comment.user?.username || 'Traveler' })}
                         className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
                       >
                         <span className="material-symbols-outlined text-[14px]">reply</span> Reply
                       </button>
                       {comment.replies && comment.replies.length > 0 && (
                         <button 
                           onClick={() => toggleReplies(comment._id)}
                           className="text-xs font-bold text-primary transition-colors flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full"
                         >
                           {collapsedReplies[comment._id] ? (
                             <><span className="material-symbols-outlined text-[14px]">expand_more</span> Show {comment.replies.length} replies</>
                           ) : (
                             <><span className="material-symbols-outlined text-[14px]">expand_less</span> Hide replies</>
                           )}
                         </button>
                       )}
                     </div>
                  </div>
                </div>
                
                {/* Replies Section */}
                {comment.replies && comment.replies.length > 0 && !collapsedReplies[comment._id] && (
                  <div className="ml-14 mt-2 space-y-4 border-l-2 border-outline-variant/20 pl-4">
                    {comment.replies.map((reply, rIdx) => (
                      <div key={reply._id || rIdx} className="flex gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-surface-container overflow-hidden border border-outline-variant/30 flex items-center justify-center">
                           {reply.user?.profileIconUrl ? (
                             <img src={reply.user.profileIconUrl} alt={reply.user.username} className="w-full h-full object-cover" />
                           ) : (
                             <span className="material-symbols-outlined text-on-surface/30 text-xs">person</span>
                           )}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-xs text-on-surface truncate">{reply.user?.nickname || reply.user?.username || 'Traveler'}</span>
                              <span className="text-[10px] text-outline font-medium uppercase tracking-wider">
                                {new Date(reply.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                           </div>
                           <div className="bg-surface-container-lowest rounded-2xl rounded-tl-none p-3 border border-outline-variant/10 text-sm text-on-surface-variant">
                              {reply.text}
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-surface-container-lowest border-t border-outline-variant/30 flex flex-col">
          {replyingTo && (
            <div className="flex items-center justify-between bg-surface-container-low px-4 py-2 rounded-t-xl text-xs text-on-surface-variant font-medium">
              <span>Replying to <span className="font-bold text-primary">@{replyingTo.name}</span></span>
              <button onClick={() => setReplyingTo(null)} className="hover:text-error transition-colors"><span className="material-symbols-outlined text-[14px]">close</span></button>
            </div>
          )}
          <form onSubmit={handlePostComment} className={`flex items-center gap-3 bg-surface p-2 border border-outline-variant/50 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all shadow-sm ${replyingTo ? 'rounded-b-xl rounded-t-none border-t-0' : 'rounded-full'}`}>
            <div className="flex-1 pl-4">
              <input 
                type="text" 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyingTo ? "Write a reply..." : "Write a supportive comment..."} 
                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 placeholder:text-outline text-on-surface"
              />
            </div>
            <button 
              type="submit"
              disabled={posting || !newComment.trim()}
              className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:grayscale-[50%]"
            >
              {posting ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-sm">send</span>
              )}
            </button>
          </form>
          <p className="text-[10px] text-center mt-3 text-outline font-medium tracking-wide">
            Remember to be respectful and helpful to your fellow travelers.
          </p>
        </div>
      </div>
    </div>
  );
}
