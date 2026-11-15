'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  FastForward,
  Search,
  Bell,
  User,
  Film,
  Music,
  Flame,
  Clock,
  Heart,
  Share2,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Key,
  Info,
  Tv,
  Sparkles,
  Download,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Menu,
  ShieldCheck,
  Gauge
} from 'lucide-react';
import { YouTubeUploader } from '../components/youtube-uploader';

const API_BASE = typeof window !== 'undefined' && window.location.hostname.includes('wavemusic')
  ? 'https://api.wavemusic.dpdns.org'
  : 'http://localhost:4000';

export interface VideoItem {
  id: string;
  title: string;
  channel: string;
  channelAvatar: string;
  subscribers: string;
  views: string;
  time: string;
  duration: string;
  thumbnail: string;
  videoUrl: string;
  category: string;
  description: string;
  likesCount: number;
  commentsCount: number;
  verified?: boolean;
}

export interface CommentItem {
  id: string;
  user: string;
  avatar: string;
  time: string;
  text: string;
  likes: number;
}

export default function VDPlayerApp() {
  // Navigation & View States
  const [currentView, setCurrentView] = useState<'home' | 'watch' | 'movies' | 'music' | 'watchlist'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpenMobile, setSearchOpenMobile] = useState<boolean>(false);

  // Videos State - Exclusively Real Videos from Database (Mock test videos deleted)
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState<boolean>(true);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  // Watchlist & Liked
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [likedList, setLikedList] = useState<string[]>([]);

  // Video Player Controls & State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoVolume, setVideoVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Comments
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newCommentInput, setNewCommentInput] = useState<string>('');

  // Auth & Admin State (vasanth013)
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    role?: string;
  } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);

  // Modals
  const [showSignInModal, setShowSignInModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<VideoItem | null>(null);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [infoModalVideo, setInfoModalVideo] = useState<VideoItem | null>(null);

  // Edit Video Form State
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Movies');
  const [editThumbnailUrl, setEditThumbnailUrl] = useState<string>('');
  const [editTags, setEditTags] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Delete Action State
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Sign In Form State
  const [authUsername, setAuthUsername] = useState<string>('vasanth013');
  const [authPassword, setAuthPassword] = useState<string>('VASAnth@2008');
  const [authError, setAuthError] = useState<string>('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check if active user is vasanth013 admin
  const isVasanthAdmin = Boolean(
    currentUser &&
    (currentUser.username?.toLowerCase() === 'vasanth013' ||
     currentUser.role === 'SUPER_ADMIN' ||
     currentUser.username?.toLowerCase().includes('vasanth'))
  );

  // Carousel refs for smooth horizontal scrolling
  const trendingRowRef = useRef<HTMLDivElement>(null);
  const moviesRowRef = useRef<HTMLDivElement>(null);
  const musicRowRef = useRef<HTMLDivElement>(null);
  const recentRowRef = useRef<HTMLDivElement>(null);

  const scrollRow = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Load Saved Auth & Watchlist from localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('platform_user');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
      const storedWatchlist = localStorage.getItem('vd_watchlist');
      if (storedWatchlist) {
        setWatchlist(JSON.parse(storedWatchlist));
      }
      const storedLiked = localStorage.getItem('vd_liked');
      if (storedLiked) {
        setLikedList(JSON.parse(storedLiked));
      }
    } catch {}
  }, []);

  // Fetch Real Videos from Backend Database
  const fetchVideos = async () => {
    setLoadingVideos(true);
    try {
      const res = await fetch(`${API_BASE}/api/youtube/videos`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: VideoItem[] = data.map((sv: any) => ({
            id: sv.id,
            title: sv.title,
            channel: sv.channel ? sv.channel.title : 'VD Player Studios',
            channelAvatar: sv.channel?.avatarUrl || '/vd-logo.jpg',
            subscribers: sv.channel ? `${(sv.channel.subscriberCount / 1000).toFixed(0)}K` : 'Official',
            views: `${sv.viewsCount || 0} views`,
            time: sv.createdAt ? new Date(sv.createdAt).toLocaleDateString() : 'Recent',
            duration: formatDuration(sv.durationSeconds || 180),
            thumbnail: sv.thumbnailUrl?.startsWith('http')
              ? sv.thumbnailUrl
              : `${API_BASE}${sv.thumbnailUrl || ''}`,
            videoUrl: sv.masterPlaylistUrl?.startsWith('http')
              ? sv.masterPlaylistUrl
              : `${API_BASE}${sv.masterPlaylistUrl}`,
            category: sv.tags && sv.tags[0] ? sv.tags[0] : 'Movies',
            description: sv.description || 'Watch now exclusively on VD Player in high-definition quality with fast Cloudflare R2 streaming.',
            likesCount: sv.likesCount || 0,
            commentsCount: sv.commentCount || 0,
            verified: true
          }));
          setVideos(mapped);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch videos:', err);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Format seconds to HH:MM:SS or MM:SS
  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Watch video handler
  const handleWatchVideo = (video: VideoItem) => {
    setActiveVideo(video);
    setCurrentView('watch');
    setIsPlaying(true);
    setVideoProgress(0);
    setBufferedPercent(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Video playback controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 1;
    setVideoCurrentTime(cur);
    setVideoDuration(dur);
    setVideoProgress((cur / dur) * 100);
  };

  const handleProgressBuffer = () => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const v = videoRef.current;
    if (v.buffered.length > 0) {
      const bufferedEnd = v.buffered.end(v.buffered.length - 1);
      setBufferedPercent((bufferedEnd / v.duration) * 100);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const pct = parseFloat(e.target.value);
    const seekTime = (pct / 100) * (videoRef.current.duration || 0);
    videoRef.current.currentTime = seekTime;
    setVideoProgress(pct);
  };

  const skipSeconds = (secs: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + secs));
    videoRef.current.currentTime = newTime;
    showToast(`${secs > 0 ? '+' : ''}${secs}s`);
  };

  const changePlaybackSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    showToast(`Speed: ${speed}x`);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVideoVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    const elem = document.getElementById('vd-player-container');
    if (!elem) return;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Auto-hide controls when playing
  const handleMouseMovePlayer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  };

  // Watchlist Toggle
  const toggleWatchlist = (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWatchlist((prev) => {
      let updated: string[];
      if (prev.includes(videoId)) {
        updated = prev.filter((id) => id !== videoId);
        showToast('Removed from Watchlist');
      } else {
        updated = [...prev, videoId];
        showToast('Added to Watchlist');
      }
      localStorage.setItem('vd_watchlist', JSON.stringify(updated));
      return updated;
    });
  };

  // Like Toggle
  const toggleLike = (videoId: string) => {
    setLikedList((prev) => {
      let updated: string[];
      if (prev.includes(videoId)) {
        updated = prev.filter((id) => id !== videoId);
      } else {
        updated = [...prev, videoId];
        showToast('Liked video');
      }
      localStorage.setItem('vd_liked', JSON.stringify(updated));
      return updated;
    });
  };

  // Share
  const handleShare = (video: VideoItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/?v=${video.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      showToast('Link copied to clipboard!');
    }
  };

  // Post Comment
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentInput.trim() || !activeVideo) return;
    const newC: CommentItem = {
      id: `c-${Date.now()}`,
      user: currentUser ? currentUser.displayName || currentUser.username : 'Viewer',
      avatar: currentUser?.avatarUrl || '/vd-logo.jpg',
      time: 'Just now',
      text: newCommentInput.trim(),
      likes: 0
    };
    setComments((prev) => [newC, ...prev]);
    setNewCommentInput('');
    showToast('Comment posted!');
  };

  // --- Exclusive Admin Actions (vasanth013) ---

  // Open Edit Modal
  const handleOpenEdit = (video: VideoItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isVasanthAdmin) {
      setShowSignInModal(true);
      return;
    }
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description);
    setEditCategory(video.category);
    setEditThumbnailUrl(video.thumbnail);
    setEditTags(video.category);
    setShowEditModal(true);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;
    setIsSavingEdit(true);
    try {
      const token = localStorage.getItem('platform_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/videos/${editingVideo.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'VASAnth@2008',
          'x-admin-user': 'vasanth013',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          category: editCategory,
          thumbnailUrl: editThumbnailUrl.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update video');
      }

      setVideos((prev) =>
        prev.map((v) =>
          v.id === editingVideo.id
            ? {
                ...v,
                title: editTitle.trim(),
                description: editDescription.trim(),
                category: editCategory,
                thumbnail: editThumbnailUrl.trim() || v.thumbnail
              }
            : v
        )
      );

      if (activeVideo && activeVideo.id === editingVideo.id) {
        setActiveVideo((prev) =>
          prev
            ? {
                ...prev,
                title: editTitle.trim(),
                description: editDescription.trim(),
                category: editCategory,
                thumbnail: editThumbnailUrl.trim() || prev.thumbnail
              }
            : null
        );
      }

      setShowEditModal(false);
      setEditingVideo(null);
      showToast('Video details updated successfully!');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (video: VideoItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isVasanthAdmin) {
      setShowSignInModal(true);
      return;
    }
    setDeletingVideo(video);
    setShowDeleteModal(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingVideo) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('platform_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/videos/${deletingVideo.id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': 'VASAnth@2008',
          'x-admin-user': 'vasanth013',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete video');
      }

      setVideos((prev) => prev.filter((v) => v.id !== deletingVideo.id));
      if (activeVideo && activeVideo.id === deletingVideo.id) {
        setActiveVideo(null);
        setCurrentView('home');
      }

      setShowDeleteModal(false);
      setDeletingVideo(null);
      showToast(`Video "${deletingVideo.title}" permanently deleted!`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: authUsername.trim(),
          password: authPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials.');
      }

      setCurrentUser(data.user);
      localStorage.setItem('platform_user', JSON.stringify(data.user));
      localStorage.setItem('platform_token', data.tokens.accessToken);
      localStorage.setItem('token', data.tokens.accessToken);
      setShowSignInModal(false);
      showToast(`Logged in as Administrator (${data.user.username})`);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('platform_user');
    localStorage.removeItem('platform_token');
    localStorage.removeItem('token');
    setUserMenuOpen(false);
    showToast('Signed out.');
  };

  // Upload Complete Callback
  const handleUploadSuccess = (sv: any) => {
    fetchVideos();
    setShowUploadModal(false);
    showToast('New video uploaded and published to Cloudflare R2!');
  };

  // Featured Hero Banner Video (Prefer 96 movie or latest)
  const featuredVideo =
    videos.find((v) => v.title.toLowerCase().includes('96') || v.title.toLowerCase().includes('hd')) ||
    videos[0] ||
    null;

  // Filtered Lists
  const filteredVideos = videos.filter((v) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      v.category.toLowerCase() === selectedCategory.toLowerCase() ||
      v.title.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch =
      searchQuery === '' ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const movieVideos = videos.filter(
    (v) =>
      v.category.toLowerCase().includes('movie') ||
      v.title.toLowerCase().includes('movie') ||
      v.title.toLowerCase().includes('1080p') ||
      v.duration.includes(':') && v.duration.length > 5
  );

  const musicVideos = videos.filter(
    (v) =>
      v.category.toLowerCase().includes('music') ||
      v.title.toLowerCase().includes('song') ||
      v.title.toLowerCase().includes('spark') ||
      v.title.toLowerCase().includes('beats')
  );

  const watchlistVideos = videos.filter((v) => watchlist.includes(v.id));

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#08090d',
        color: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            zIndex: 9999,
            background: 'rgba(20, 22, 30, 0.95)',
            border: '1px solid rgba(229, 9, 20, 0.6)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backdropFilter: 'blur(10px)'
          }}
        >
          <CheckCircle2 size={18} color="#e50914" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ================= 1. NETFLIX & HOTSTAR CINEMATIC HEADER ================= */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(8, 9, 13, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: '68px'
        }}
      >
        {/* Left: Brand Logo & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div
            onClick={() => {
              setCurrentView('home');
              setActiveVideo(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer'
            }}
          >
            {/* Logo image with stylish glow */}
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '2px solid rgba(229, 9, 20, 0.7)',
                boxShadow: '0 0 15px rgba(229, 9, 20, 0.4)',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src="/vd-logo.jpg"
                alt="VD Player"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  letterSpacing: '1px',
                  background: 'linear-gradient(90deg, #ff2e3a 0%, #ff8a00 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: '1.1'
                }}
              >
                VD PLAYER
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#9ca3af',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase'
                }}
              >
                Cinematic Streaming
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px'
            }}
            className="hidden-mobile"
          >
            {[
              { id: 'home', label: 'Home' },
              { id: 'movies', label: 'Movies & Premieres' },
              { id: 'music', label: 'Music & Audio' },
              { id: 'watchlist', label: `My List (${watchlist.length})` }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id as any);
                  setActiveVideo(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: currentView === item.id ? '#fff' : '#9ca3af',
                  fontWeight: currentView === item.id ? 700 : 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '6px 0',
                  transition: 'color 0.2s'
                }}
              >
                {item.label}
                {currentView === item.id && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: '#e50914',
                      borderRadius: '2px'
                    }}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Section: Search & Admin Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Search Bar */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              placeholder="Search movies, songs, actors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '20px',
                padding: '8px 16px 8px 38px',
                color: '#fff',
                fontSize: '13px',
                width: searchQuery ? '220px' : '170px',
                transition: 'all 0.3s ease',
                outline: 'none'
              }}
            />
            <Search
              size={16}
              color="#9ca3af"
              style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Upload Button: Exclusive to vasanth013 */}
          {isVasanthAdmin ? (
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                background: 'linear-gradient(135deg, #e50914 0%, #b20710 100%)',
                border: 'none',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(229, 9, 20, 0.4)'
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="hidden-mobile">Upload Video</span>
            </button>
          ) : (
            <button
              onClick={() => setShowSignInModal(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <User size={15} />
              <span>Admin Login</span>
            </button>
          )}

          {/* User / Admin Menu */}
          {currentUser && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: isVasanthAdmin ? 'rgba(229, 9, 20, 0.15)' : 'rgba(255,255,255,0.06)',
                  border: isVasanthAdmin ? '1px solid rgba(229, 9, 20, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '24px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  color: '#fff'
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#e50914',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px'
                  }}
                >
                  {currentUser.username.slice(0, 2).toUpperCase()}
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isVasanthAdmin ? '#ff8a00' : '#fff'
                  }}
                  className="hidden-mobile"
                >
                  {currentUser.username} {isVasanthAdmin && '👑'}
                </span>
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    width: '220px',
                    background: '#12141c',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                    zIndex: 200,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>
                      {currentUser.displayName || currentUser.username}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {currentUser.email || `${currentUser.username}@vdplayer.com`}
                    </div>
                    {isVasanthAdmin && (
                      <div
                        style={{
                          marginTop: '6px',
                          display: 'inline-block',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: 'rgba(229, 9, 20, 0.2)',
                          color: '#ff4d58',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        SUPER ADMIN & CREATOR
                      </div>
                    )}
                  </div>

                  <a
                    href="http://localhost:3001"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 16px',
                      color: '#d1d5db',
                      textDecoration: 'none',
                      fontSize: '13px'
                    }}
                  >
                    <ShieldCheck size={16} />
                    <span>Admin R2 Console</span>
                  </a>

                  <button
                    onClick={handleSignOut}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      color: '#ef4444',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ================= 2. ACTIVE VIEW ROUTING ================= */}
      {currentView === 'watch' && activeVideo ? (
        /* ================= 2A. CINEMATIC VIDEO PLAYER VIEW ================= */
        <div style={{ flex: 1, padding: '16px 20px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {/* Back button */}
          <button
            onClick={() => {
              setCurrentView('home');
              if (videoRef.current) videoRef.current.pause();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '16px',
              padding: 0
            }}
          >
            <ChevronLeft size={20} />
            <span>Back to Browse</span>
          </button>

          {/* Video Player Container */}
          <div
            id="vd-player-container"
            onMouseMove={handleMouseMovePlayer}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              maxHeight: '75vh',
              background: '#000',
              borderRadius: isFullscreen ? '0px' : '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
            }}
          >
            <video
              ref={videoRef}
              src={activeVideo.videoUrl}
              poster={activeVideo.thumbnail}
              preload="auto"
              playsInline
              autoPlay
              onTimeUpdate={handleTimeUpdate}
              onProgress={handleProgressBuffer}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />

            {/* VD Player Watermark */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: showControls ? 0.9 : 0.3,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none'
              }}
            >
              <img src="/vd-logo.jpg" alt="VD" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
              <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                VD PLAYER
              </span>
            </div>

            {/* Performance streaming badge */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '20px',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: showControls ? 1 : 0,
                transition: 'opacity 0.3s'
              }}
            >
              <Gauge size={13} />
              <span>Direct R2 Range Streaming • Fast Buffering</span>
            </div>

            {/* Center Big Play Button if paused */}
            {!isPlaying && (
              <div
                onClick={togglePlay}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.4)',
                  cursor: 'pointer'
                }}
              >
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: '#e50914',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 30px rgba(229, 9, 20, 0.6)'
                  }}
                >
                  <Play size={34} fill="#fff" color="#fff" style={{ marginLeft: '4px' }} />
                </div>
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                opacity: showControls ? 1 : 0,
                transition: 'opacity 0.3s ease'
              }}
            >
              {/* Progress Scrubber Bar */}
              <div style={{ position: 'relative', width: '100%', height: '6px', cursor: 'pointer' }}>
                {/* Background Track */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '3px'
                  }}
                />
                {/* Buffer Track */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${bufferedPercent}%`,
                    background: 'rgba(255, 255, 255, 0.45)',
                    borderRadius: '3px',
                    transition: 'width 0.2s'
                  }}
                />
                {/* Played Track */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${videoProgress}%`,
                    background: '#e50914',
                    borderRadius: '3px'
                  }}
                />
                {/* Range Input for Scrubbing */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={videoProgress}
                  onChange={handleSeek}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    margin: 0
                  }}
                />
              </div>

              {/* Controls Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button
                    onClick={togglePlay}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
                  >
                    {isPlaying ? <Pause size={22} /> : <Play size={22} fill="#fff" />}
                  </button>

                  <button
                    onClick={() => skipSeconds(-10)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
                    title="Rewind 10s"
                  >
                    <RotateCcw size={18} />
                  </button>

                  <button
                    onClick={() => skipSeconds(10)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
                    title="Skip 10s"
                  >
                    <FastForward size={18} />
                  </button>

                  {/* Volume */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={toggleMute}
                      style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
                    >
                      {isMuted || videoVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : videoVolume}
                      onChange={handleVolumeChange}
                      style={{ width: '60px', height: '4px', accentColor: '#e50914', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Time Counter */}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', marginLeft: '6px' }}>
                    {formatDuration(videoCurrentTime)} / {formatDuration(videoDuration)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Playback speed buttons */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => changePlaybackSpeed(spd)}
                        style={{
                          background: playbackSpeed === spd ? 'rgba(229, 9, 20, 0.4)' : 'rgba(255,255,255,0.08)',
                          border: playbackSpeed === spd ? '1px solid #e50914' : 'none',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
                  >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video Metadata & Actions Bar */}
          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: '#0f1118',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#fff' }}>
                  {activeVideo.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#9ca3af', fontSize: '13px' }}>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>1080p Ultra HD</span>
                  <span>•</span>
                  <span>{activeVideo.views}</span>
                  <span>•</span>
                  <span>{activeVideo.time}</span>
                  <span>•</span>
                  <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                    {activeVideo.category}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => toggleLike(activeVideo.id)}
                  style={{
                    background: likedList.includes(activeVideo.id) ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.08)',
                    border: likedList.includes(activeVideo.id) ? '1px solid #e50914' : '1px solid rgba(255,255,255,0.15)',
                    color: likedList.includes(activeVideo.id) ? '#ff4d58' : '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Heart size={16} fill={likedList.includes(activeVideo.id) ? '#ff4d58' : 'none'} />
                  <span>{likedList.includes(activeVideo.id) ? 'Liked' : 'Like'}</span>
                </button>

                <button
                  onClick={() => toggleWatchlist(activeVideo.id)}
                  style={{
                    background: watchlist.includes(activeVideo.id) ? 'rgba(255, 170, 0, 0.2)' : 'rgba(255,255,255,0.08)',
                    border: watchlist.includes(activeVideo.id) ? '1px solid #ffaa00' : '1px solid rgba(255,255,255,0.15)',
                    color: watchlist.includes(activeVideo.id) ? '#ffaa00' : '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {watchlist.includes(activeVideo.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  <span>Watchlist</span>
                </button>

                <button
                  onClick={(e) => handleShare(activeVideo, e)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Share2 size={16} />
                  <span>Share</span>
                </button>

                {/* Admin Only Edit & Delete Controls */}
                {isVasanthAdmin && (
                  <>
                    <button
                      onClick={(e) => handleOpenEdit(activeVideo, e)}
                      style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid #3b82f6',
                        color: '#60a5fa',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Edit3 size={15} />
                      <span>Edit Video</span>
                    </button>

                    <button
                      onClick={(e) => handleOpenDelete(activeVideo, e)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        color: '#f87171',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 size={15} />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <p style={{ margin: 0, color: '#d1d5db', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {activeVideo.description}
            </p>
          </div>

          {/* Comments Section */}
          <div
            style={{
              marginTop: '24px',
              background: '#0f1118',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#fff' }}>
              Comments ({comments.length})
            </h3>

            {/* Add Comment */}
            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Add a comment to this stream..."
                value={newCommentInput}
                onChange={(e) => setNewCommentInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#e50914',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Post
              </button>
            </form>

            {/* Comment List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px'
                  }}
                >
                  <img src={c.avatar} alt={c.user} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>{c.user}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{c.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#d1d5db' }}>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ================= 2B. NETFLIX & HOTSTAR HOMEPAGE BROWSING ================= */
        <main style={{ flex: 1, paddingBottom: '90px' }}>
          {/* ================= HERO CINEMATIC BILLBOARD ================= */}
          {featuredVideo && !searchQuery && currentView === 'home' && (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '70vh',
                minHeight: '480px',
                maxHeight: '680px',
                overflow: 'hidden'
              }}
            >
              {/* Background Poster / Backdrop */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${featuredVideo.thumbnail})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'brightness(0.65)'
                }}
              />

              {/* Cinematic Gradient Overlays (Netflix / JioHotstar signature look) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, #08090d 10%, rgba(8, 9, 13, 0.7) 45%, rgba(8, 9, 13, 0.1) 80%, rgba(8, 9, 13, 0.6) 100%)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to right, #08090d 0%, rgba(8, 9, 13, 0.8) 35%, transparent 70%)'
                }}
              />

              {/* Billboard Content */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '40px',
                  left: '32px',
                  maxWidth: '650px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  zIndex: 10
                }}
              >
                {/* Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      background: '#e50914',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 900,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      letterSpacing: '1px'
                    }}
                  >
                    FEATURED PREMIERE
                  </span>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(8px)',
                      color: '#22c55e',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    4K ULTRA HD
                  </span>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      color: '#ffaa00',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    DOLBY 5.1
                  </span>
                </div>

                {/* Title */}
                <h1
                  style={{
                    fontSize: '36px',
                    fontWeight: 900,
                    margin: 0,
                    lineHeight: '1.15',
                    color: '#fff',
                    textShadow: '0 4px 16px rgba(0,0,0,0.8)'
                  }}
                >
                  {featuredVideo.title}
                </h1>

                {/* Synopsis */}
                <p
                  style={{
                    margin: 0,
                    color: '#e5e7eb',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                  }}
                >
                  {featuredVideo.description}
                </p>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                  <button
                    onClick={() => handleWatchVideo(featuredVideo)}
                    style={{
                      background: '#fff',
                      border: 'none',
                      color: '#000',
                      padding: '12px 28px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 8px 24px rgba(255,255,255,0.25)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <Play size={20} fill="#000" />
                    <span>Watch Now</span>
                  </button>

                  <button
                    onClick={() => toggleWatchlist(featuredVideo.id)}
                    style={{
                      background: 'rgba(109, 109, 110, 0.7)',
                      backdropFilter: 'blur(10px)',
                      border: 'none',
                      color: '#fff',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {watchlist.includes(featuredVideo.id) ? (
                      <>
                        <BookmarkCheck size={18} color="#ffaa00" />
                        <span>In My List</span>
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        <span>My List</span>
                      </>
                    )}
                  </button>

                  {/* Admin controls right on hero */}
                  {isVasanthAdmin && (
                    <button
                      onClick={(e) => handleOpenEdit(featuredVideo, e)}
                      style={{
                        background: 'rgba(59, 130, 246, 0.4)',
                        border: '1px solid #3b82f6',
                        color: '#fff',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Edit3 size={16} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= CAROUSEL ROWS (NETFLIX / JIOHOTSTAR STYLE) ================= */}
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '38px' }}>
            {/* Category Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
              {['All', 'Movies', 'Music', 'Trending', 'Premieres'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    background: selectedCategory === cat ? '#e50914' : 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: '#fff',
                    padding: '7px 18px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: selectedCategory === cat ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Row 1: Trending Now on VD Player */}
            <VideoCarouselRow
              title="🔥 Trending Now on VD Player"
              videos={filteredVideos}
              rowRef={trendingRowRef}
              onScroll={(dir) => scrollRow(trendingRowRef, dir)}
              onWatch={handleWatchVideo}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              onWatchlistToggle={toggleWatchlist}
              watchlist={watchlist}
              isAdmin={isVasanthAdmin}
            />

            {/* Row 2: Blockbuster Movies & HD Premieres */}
            {movieVideos.length > 0 && (
              <VideoCarouselRow
                title="🎬 Blockbuster Movies & HD Premieres"
                videos={movieVideos}
                rowRef={moviesRowRef}
                onScroll={(dir) => scrollRow(moviesRowRef, dir)}
                onWatch={handleWatchVideo}
                onEdit={handleOpenEdit}
                onDelete={handleOpenDelete}
                onWatchlistToggle={toggleWatchlist}
                watchlist={watchlist}
                isAdmin={isVasanthAdmin}
              />
            )}

            {/* Row 3: Music & Acoustic Originals */}
            {musicVideos.length > 0 && (
              <VideoCarouselRow
                title="🎵 Music, Acoustic & Bass Hits"
                videos={musicVideos}
                rowRef={musicRowRef}
                onScroll={(dir) => scrollRow(musicRowRef, dir)}
                onWatch={handleWatchVideo}
                onEdit={handleOpenEdit}
                onDelete={handleOpenDelete}
                onWatchlistToggle={toggleWatchlist}
                watchlist={watchlist}
                isAdmin={isVasanthAdmin}
              />
            )}

            {/* Row 4: My Watchlist */}
            {watchlistVideos.length > 0 && (
              <VideoCarouselRow
                title="⭐ My Watchlist"
                videos={watchlistVideos}
                rowRef={recentRowRef}
                onScroll={(dir) => scrollRow(recentRowRef, dir)}
                onWatch={handleWatchVideo}
                onEdit={handleOpenEdit}
                onDelete={handleOpenDelete}
                onWatchlistToggle={toggleWatchlist}
                watchlist={watchlist}
                isAdmin={isVasanthAdmin}
              />
            )}

            {/* Empty State */}
            {videos.length === 0 && !loadingVideos && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  background: '#0f1118',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <Film size={48} color="#e50914" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>
                  No videos uploaded yet
                </h3>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 20px 0' }}>
                  Log in as administrator (vasanth013) to upload your first movie or video straight to Cloudflare R2!
                </p>
                <button
                  onClick={() => setShowSignInModal(true)}
                  style={{
                    background: '#e50914',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Admin Login
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ================= 3. MOBILE STICKY BOTTOM NAVIGATION BAR ================= */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'rgba(8, 9, 13, 0.96)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '8px 0 10px 0'
        }}
        className="show-mobile-only"
      >
        <button
          onClick={() => {
            setCurrentView('home');
            setActiveVideo(null);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentView === 'home' ? '#e50914' : '#9ca3af',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Film size={20} />
          <span>Home</span>
        </button>

        <button
          onClick={() => {
            setCurrentView('movies');
            setActiveVideo(null);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentView === 'movies' ? '#e50914' : '#9ca3af',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Tv size={20} />
          <span>Movies</span>
        </button>

        {/* Upload Button for Mobile */}
        <button
          onClick={() => {
            if (isVasanthAdmin) {
              setShowUploadModal(true);
            } else {
              setShowSignInModal(true);
            }
          }}
          style={{
            background: '#e50914',
            border: 'none',
            color: '#fff',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(229, 9, 20, 0.6)'
          }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>

        <button
          onClick={() => {
            setCurrentView('watchlist');
            setActiveVideo(null);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentView === 'watchlist' ? '#e50914' : '#9ca3af',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Bookmark size={20} />
          <span>My List</span>
        </button>

        <button
          onClick={() => {
            if (currentUser) {
              setUserMenuOpen(!userMenuOpen);
            } else {
              setShowSignInModal(true);
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentUser ? '#e50914' : '#9ca3af',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <User size={20} />
          <span>{currentUser ? 'Admin' : 'Login'}</span>
        </button>
      </div>

      {/* ================= 4. MODALS ================= */}

      {/* 4A. SIGN IN MODAL (vasanth013) */}
      {showSignInModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#12141c',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              width: '420px',
              maxWidth: '92vw',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/vd-logo.jpg" alt="VD" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                  Admin Sign In
                </h2>
              </div>
              <button
                onClick={() => setShowSignInModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#9ca3af', lineHeight: '1.5' }}>
              Only user <strong>vasanth013</strong> can upload, edit details, and delete videos from Cloudflare R2.
            </p>

            {authError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '16px'
                }}
              >
                {authError}
              </div>
            )}

            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#d1d5db', marginBottom: '6px' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#d1d5db', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                style={{
                  marginTop: '8px',
                  background: '#e50914',
                  border: 'none',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(229, 9, 20, 0.4)'
                }}
              >
                {isSubmittingAuth ? 'Signing In...' : 'Sign In as Administrator'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4B. EDIT VIDEO DETAILS MODAL (vasanth013) */}
      {showEditModal && editingVideo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#12141c',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              width: '540px',
              maxWidth: '92vw',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="#60a5fa" />
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                  Edit Video Details
                </h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#d1d5db', marginBottom: '6px' }}>
                  Video Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#d1d5db', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#d1d5db', marginBottom: '6px' }}>
                  Category / Genre
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#1a1d28',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Movies">Movies & Premieres</option>
                  <option value="Music">Music & Audio Hits</option>
                  <option value="Series">Series & Shows</option>
                  <option value="Trending">Trending</option>
                  <option value="Action">Action & Thriller</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#d1d5db', marginBottom: '6px' }}>
                  Thumbnail URL
                </label>
                <input
                  type="text"
                  value={editThumbnailUrl}
                  onChange={(e) => setEditThumbnailUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: '#9ca3af',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  style={{
                    background: '#3b82f6',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4C. DELETE VIDEO CONFIRMATION MODAL (vasanth013) */}
      {showDeleteModal && deletingVideo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#12141c',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              width: '440px',
              maxWidth: '92vw',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                Permanently Delete Video?
              </h2>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#d1d5db', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete:
            </p>

            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '16px'
              }}
            >
              {deletingVideo.title}
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#9ca3af', lineHeight: '1.4' }}>
              This will remove the record from PostgreSQL and purge all associated video chunks across Cloudflare R2 buckets, freeing up storage quota.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#9ca3af',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4D. UPLOAD VIDEO MODAL (Exclusive to vasanth013) */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <YouTubeUploader
            onClose={() => setShowUploadModal(false)}
            onUploadSuccess={handleUploadSuccess}
            onWatchVideo={handleWatchVideo}
            apiBase={API_BASE}
          />
        </div>
      )}

      {/* Global CSS for Mobile Responsiveness & Carousels */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .hidden-mobile {
            display: none !important;
          }
          .show-mobile-only {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .show-mobile-only {
            display: none !important;
          }
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #08090d;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(229, 9, 20, 0.6);
        }
      `}</style>
    </div>
  );
}

// ================= VIDEO CAROUSEL ROW COMPONENT (NETFLIX / JIOHOTSTAR) =================
interface VideoCarouselRowProps {
  title: string;
  videos: VideoItem[];
  rowRef: React.RefObject<HTMLDivElement>;
  onScroll: (direction: 'left' | 'right') => void;
  onWatch: (video: VideoItem) => void;
  onEdit: (video: VideoItem, e?: React.MouseEvent) => void;
  onDelete: (video: VideoItem, e?: React.MouseEvent) => void;
  onWatchlistToggle: (id: string, e?: React.MouseEvent) => void;
  watchlist: string[];
  isAdmin: boolean;
}

function VideoCarouselRow({
  title,
  videos,
  rowRef,
  onScroll,
  onWatch,
  onEdit,
  onDelete,
  onWatchlistToggle,
  watchlist,
  isAdmin
}: VideoCarouselRowProps) {
  if (videos.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
      {/* Row Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '0.3px' }}>
          {title}
        </h2>
        {/* Carousel Scroll Chevrons */}
        <div style={{ display: 'flex', gap: '6px' }} className="hidden-mobile">
          <button
            onClick={() => onScroll('left')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => onScroll('right')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={rowRef}
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '12px',
          paddingTop: '4px'
        }}
      >
        {videos.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            onWatch={() => onWatch(v)}
            onEdit={(e) => onEdit(v, e)}
            onDelete={(e) => onDelete(v, e)}
            onWatchlistToggle={(e) => onWatchlistToggle(v.id, e)}
            isSaved={watchlist.includes(v.id)}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

// ================= VIDEO CARD COMPONENT =================
interface VideoCardProps {
  video: VideoItem;
  onWatch: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onWatchlistToggle: (e: React.MouseEvent) => void;
  isSaved: boolean;
  isAdmin: boolean;
}

function VideoCard({
  video,
  onWatch,
  onEdit,
  onDelete,
  onWatchlistToggle,
  isSaved,
  isAdmin
}: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onWatch}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        flex: '0 0 280px',
        maxWidth: '280px',
        scrollSnapAlign: 'start',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative'
      }}
    >
      {/* Thumbnail Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#12141c',
          border: isHovered ? '2px solid rgba(229, 9, 20, 0.8)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isHovered ? '0 12px 28px rgba(0,0,0,0.8)' : '0 4px 12px rgba(0,0,0,0.4)',
          transform: isHovered ? 'scale(1.04)' : 'scale(1)',
          transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)'
        }}
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Duration pill */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: 'rgba(0,0,0,0.85)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#fff'
          }}
        >
          {video.duration}
        </div>

        {/* Quality Badge */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: 'rgba(229, 9, 20, 0.85)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.5px'
          }}
        >
          HD
        </div>

        {/* Hover Action Overlay */}
        {isHovered && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#e50914',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(229, 9, 20, 0.6)'
              }}
            >
              <Play size={20} fill="#fff" color="#fff" style={{ marginLeft: '2px' }} />
            </div>

            <button
              onClick={onWatchlistToggle}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: isSaved ? '#ffaa00' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title={isSaved ? 'In Watchlist' : 'Add to Watchlist'}
            >
              {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
          </div>
        )}
      </div>

      {/* Video Info Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              margin: '0 0 3px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {video.title}
          </h3>
          <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '6px' }}>
            <span>{video.views}</span>
            <span>•</span>
            <span>{video.time}</span>
          </div>
        </div>

        {/* Admin Quick Actions (Exclusive to vasanth013) */}
        {isAdmin && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '6px'
            }}
          >
            <button
              onClick={onEdit}
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: 'none',
                color: '#60a5fa',
                padding: '4px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="Edit Video"
            >
              <Edit3 size={13} />
            </button>
            <button
              onClick={onDelete}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: 'none',
                color: '#f87171',
                padding: '4px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="Delete Video"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
