import React, { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePostCreation } from '../context/PostCreationContext';

// Client-side limits (must match backend)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;

export default function CreatePostModal() {
  const { isCreateModalOpen, closeCreatePostModal, editPostData, triggerRefresh } = usePostCreation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    type: 'Photo',
    title: '',
    content: '',
    image: null,
    isPublic: true,
    destination: '',
    tags: '',
  });

  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('image'); // 'image' | 'video'

  // Pre-fill if editing
  useEffect(() => {
    if (editPostData?._id) {
      // Editing an existing post
      setFormData({
        type: editPostData.type || 'Photo',
        title: editPostData.title || '',
        content: editPostData.content || '',
        image: null,
        isPublic: editPostData.isPublic !== false,
        destination: editPostData.destination || '',
        tags: Array.isArray(editPostData.activities) ? editPostData.activities.join(', ') : '',
      });
      if (editPostData.image) {
        const url = editPostData.image.startsWith('http')
          ? editPostData.image
          : `${import.meta.env.VITE_API_URL}${editPostData.image}`;
        setMediaPreview(url);
        setMediaType(editPostData.mediaType || 'image');
      }
    } else {
      // New post — may have a pre-selected type (e.g. { type: 'Photo' } from Homepage)
      setFormData({
        type: editPostData?.type || 'Photo',
        title: '',
        content: '',
        image: null,
        isPublic: true,
        destination: '',
        tags: '',
      });
      setMediaPreview(null);
      setMediaType('image');
      setMediaError('');
    }
  }, [editPostData, isCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const validateAndSetFile = (file) => {
    setMediaError('');
    if (!file) return;

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      setMediaError(`Unsupported file type "${file.type}". Allowed: JPEG, PNG, WEBP, GIF, MP4, MOV, WEBM, AVI.`);
      return;
    }

    const maxBytes = isVideo ? MAX_VIDEO_MB * 1024 * 1024 : MAX_IMAGE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setMediaError(`File too large. ${isVideo ? `Videos must be under ${MAX_VIDEO_MB}MB` : `Images must be under ${MAX_IMAGE_MB}MB`} (your file: ${(file.size / 1024 / 1024).toFixed(1)}MB).`);
      return;
    }

    setFormData(prev => ({ ...prev, image: file }));
    setMediaPreview(URL.createObjectURL(file));
    setMediaType(isVideo ? 'video' : 'image');
  };

  const handleFileChange = (e) => {
    validateAndSetFile(e.target.files[0]);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    validateAndSetFile(e.dataTransfer.files[0]);
  };

  const clearMedia = () => {
    setFormData(prev => ({ ...prev, image: null }));
    setMediaPreview(null);
    setMediaType('image');
    setMediaError('');
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      showToast('Please enter a title for your post', 'error');
      return;
    }
    if (mediaError) {
      showToast(mediaError, 'error');
      return;
    }

    try {
      setLoading(true);
      const token = JSON.parse(localStorage.getItem('authTokens'))?.token;

      const payload = new FormData();
      let finalType = formData.type;
      if (finalType === 'Photo' && !formData.image && !mediaPreview) {
        finalType = 'Tip';
      }

      payload.append('type', finalType);
      payload.append('title', formData.title);
      payload.append('content', formData.content);
      payload.append('isPublic', formData.isPublic);
      payload.append('destination', formData.destination);
      payload.append('activities', formData.tags);

      if (formData.image) {
        payload.append('image', formData.image);
      }

      const isEditing = !!(editPostData?._id);
      const url = isEditing
        ? `${import.meta.env.VITE_API_URL}/api/posts/${editPostData._id}`
        : `${import.meta.env.VITE_API_URL}/api/posts`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'x-auth-token': token },
        body: payload,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.msg || 'Failed to save post');
      }

      showToast(isEditing ? 'Post updated successfully' : 'Post created successfully', 'success');
      triggerRefresh();
      closeCreatePostModal();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-6 transition-opacity">
      <div className="relative w-full max-w-5xl h-[90vh] bg-surface rounded-[2rem] shadow-2xl flex flex-col font-body animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md shrink-0">
          <div className="text-xl font-black text-primary font-headline flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>explore</span>
            TravelBuddy
          </div>
          <button onClick={closeCreatePostModal} className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12">

          <div className="mb-10 text-center">
            <h1 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tight text-primary mb-3">
              {editPostData?._id ? 'Edit Your Story' : 'Share Your Journey'}
            </h1>
            <p className="text-on-surface-variant text-base md:text-lg">Your stories inspire the community and keep everyone safe.</p>
          </div>

          {/* Title */}
          <div className="mb-8 max-w-2xl mx-auto">
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Give your story a catchy title..."
              className="w-full bg-transparent text-center font-headline font-bold text-3xl text-on-surface placeholder:text-outline-variant outline-none focus:border-b-2 focus:border-primary/30 transition-all pb-2"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto">

            {/* Left: Text content */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary">edit_note</span>
                  <h2 className="font-headline font-bold text-on-surface text-lg">Write your story</h2>
                </div>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full h-64 bg-surface-container-low border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline text-base resize-none outline-none"
                  placeholder="Where did you go? Any safety tips for other solo travelers?"
                />
              </section>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface-container-lowest rounded-[1.5rem] p-5 flex items-center gap-4 border border-outline-variant/10">
                  <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
                    <span className="material-symbols-outlined">sell</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-headline font-bold text-on-surface text-sm">Tags / Activities</p>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="e.g. Adventure, Beach, Solo"
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs text-on-surface-variant placeholder:text-outline outline-none"
                    />
                  </div>
                </div>

                <div className="bg-surface-container-lowest rounded-[1.5rem] p-5 flex items-center gap-4 border border-outline-variant/10">
                  <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
                    <span className="material-symbols-outlined">location_on</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-headline font-bold text-on-surface text-sm">Location</p>
                    <input
                      type="text"
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      placeholder="e.g. Kyoto, Japan"
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs text-on-surface-variant placeholder:text-outline outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Media + Privacy */}
            <div className="lg:col-span-5 space-y-6">

              {/* Media upload zone */}
              <section className="relative group" onDragOver={handleDragOver} onDrop={handleDrop}>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/x-msvideo"
                  onChange={handleFileChange}
                />

                {mediaPreview ? (
                  <div className="relative h-64 lg:h-72 w-full bg-black rounded-[1.5rem] overflow-hidden border border-outline-variant/30">
                    {mediaType === 'video' ? (
                      <video src={mediaPreview} className="w-full h-full object-contain" controls />
                    ) : (
                      <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2 bg-white text-gray-900 font-bold rounded-full text-sm shadow-lg hover:scale-105 transition-transform"
                      >
                        Change
                      </button>
                      <button
                        onClick={clearMedia}
                        className="px-5 py-2 bg-red-500 text-white font-bold rounded-full text-sm shadow-lg hover:scale-105 transition-transform"
                      >
                        Remove
                      </button>
                    </div>
                    {/* Media type badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                      <span className="material-symbols-outlined text-[12px]">{mediaType === 'video' ? 'videocam' : 'image'}</span>
                      {mediaType === 'video' ? 'Video' : 'Image'}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-64 lg:h-72 w-full bg-surface-container-low rounded-[1.5rem] border-2 border-dashed border-outline-variant/50 flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all duration-300 hover:border-primary/40 hover:bg-surface-container"
                  >
                    <div className="w-16 h-16 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-sm mb-4">
                      <span className="material-symbols-outlined text-3xl text-primary">perm_media</span>
                    </div>
                    <h3 className="font-headline font-bold text-on-surface text-lg mb-1">Upload Photo or Video</h3>
                    <p className="text-xs text-on-surface-variant mb-1">Drag & drop or click to browse</p>
                    <p className="text-[10px] text-outline mb-4">Images up to {MAX_IMAGE_MB}MB · Videos up to {MAX_VIDEO_MB}MB</p>
                    <p className="text-[10px] text-outline">JPEG, PNG, WEBP, GIF, MP4, MOV, WEBM</p>
                  </div>
                )}

                {/* Error message */}
                {mediaError && (
                  <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-red-500 text-[18px] shrink-0 mt-0.5">error</span>
                    <p className="text-xs text-red-700 font-medium leading-relaxed">{mediaError}</p>
                  </div>
                )}
              </section>

              {/* Privacy */}
              <section className="bg-surface-container-lowest rounded-[1.5rem] p-6 border border-outline-variant/10">
                <h2 className="font-headline font-bold text-on-surface mb-4 text-lg">Audience</h2>
                <div className="space-y-3">
                  <label className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border ${formData.isPublic ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-low border-transparent hover:bg-surface-container-high'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined ${formData.isPublic ? 'text-primary' : 'text-outline'}`}>public</span>
                      <div>
                        <p className={`font-bold text-sm ${formData.isPublic ? 'text-primary' : 'text-on-surface'}`}>Public</p>
                        <p className="text-xs text-on-surface-variant">Visible to everyone</p>
                      </div>
                    </div>
                    <input checked={formData.isPublic} onChange={() => setFormData({ ...formData, isPublic: true })} className="w-4 h-4 text-primary" type="radio" />
                  </label>

                  <label className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border ${!formData.isPublic ? 'bg-secondary/5 border-secondary/20' : 'bg-surface-container-low border-transparent hover:bg-surface-container-high'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined ${!formData.isPublic ? 'text-secondary' : 'text-outline'}`}>verified_user</span>
                      <div>
                        <p className={`font-bold text-sm ${!formData.isPublic ? 'text-secondary' : 'text-on-surface'}`}>Followers Only</p>
                        <p className="text-xs text-on-surface-variant">Only for trusted network</p>
                      </div>
                    </div>
                    <input checked={!formData.isPublic} onChange={() => setFormData({ ...formData, isPublic: false })} className="w-4 h-4 text-secondary" type="radio" />
                  </label>
                </div>
              </section>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !!mediaError}
                className="w-full py-4 rounded-full bg-primary text-white font-headline font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><span className="material-symbols-outlined animate-spin">progress_activity</span> Uploading...</>
                  : 'Post to Community'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
