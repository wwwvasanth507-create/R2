'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Mic,
  Video,
  Bell,
  User,
  Home as HomeIcon,
  Compass,
  PlaySquare,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  BookmarkCheck,
  Check,
  MoreVertical,
  Flame,
  Music,
  Gamepad2,
  Newspaper,
  Radio,
  Tv,
  ListVideo,
  Settings,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  X,
  Plus,
  Lock,
  Key,
  LogOut,
  Send,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  FolderPlus,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { ChunkUploader } from '../components/chunk-uploader';
import { YouTubeUploader } from '../components/youtube-uploader';

const API_BASE = typeof window !== 'undefined' && window.location.hostname.includes('wavemusic')
  ? 'https://api.wavemusic.dpdns.org'
  : 'http://localhost:4000';

interface VideoItem {
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

interface ShortItem {
  id: string;
  title: string;
  channel: string;
  channelAvatar: string;
  views: string;
  videoUrl: string;
  likes: number;
  comments: number;
  musicTitle: string;
}

interface CommentItem {
  id: string;
  user: string;
  avatar: string;
  time: string;
  text: string;
  likes: number;
  isLiked?: boolean;
}

export default function YouTubePlatform() {
  // Navigation & View States
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'watch' | 'shorts' | 'watchLater' | 'liked'>('home');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Watch Page State
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [videoLikes, setVideoLikes] = useState<number>(0);
  const [isSavedWatchLater, setIsSavedWatchLater] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Video Element Ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoVolume, setVideoVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);

  // Comments State
  const [comments, setComments] = useState<CommentItem[]>([
    {
      id: 'c1',
      user: 'TechArchitect_IN',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      time: '1 hour ago',
      text: 'The 8 GiB strict logical quota design per R2 bucket avoids quota exhaustion while guaranteeing 0 egress charges! Brilliant execution.',
      likes: 84
    },
    {
      id: 'c2',
      user: 'CloudDevOps_Specialist',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
      time: '3 hours ago',
      text: 'Tested the 256 MiB multi-bucket scatter-gather streaming. The byte-range gateway handles seeking with zero stutter.',
      likes: 42
    },
    {
      id: 'c3',
      user: 'TamilMediaFan',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
      time: '5 hours ago',
      text: 'Super smooth YouTube UI experience! Loved the cinema mode and dark mode styling.',
      likes: 19
    }
  ]);
  const [newCommentInput, setNewCommentInput] = useState('');

  // Shorts State
  const [currentShortIndex, setCurrentShortIndex] = useState(0);
  const [shortsLiked, setShortsLiked] = useState<Record<string, boolean>>({});

  // Auth & User State
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl: string;
  } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Auth Modals
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Form Fields
  const [authLoginId, setAuthLoginId] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Watch Later & Liked Lists
  const [watchLaterList, setWatchLaterList] = useState<string[]>([]);
  const [likedList, setLikedList] = useState<string[]>([]);

  // Sample Authentic YouTube Video Library
  const videoDatabase: VideoItem[] = [
    {
      id: 'yt-r2-deepdive',
      title: 'Building a Petabyte-Scale Media Engine with Cloudflare R2 & Multi-Bucket Allocation',
      channel: 'Cloud Architecture & Systems',
      channelAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      subscribers: '1.24M subscribers',
      views: '482K views',
      time: '2 days ago',
      duration: '18:45',
      thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      category: 'Cloudflare R2',
      description: 'Complete breakdown of building a high-throughput video streaming infrastructure using Cloudflare R2 object storage with 0 egress costs, dynamic 8 GiB bucket allocation, SHA-256 chunk verification, and HTTP range streaming gateways.\n\nTimestamps:\n0:00 - Introduction & Cloud Storage Dilemma\n3:20 - R2 Architecture & Free Egress Policy\n7:45 - 8 GiB Logical Bucket Quotas & Spillover\n12:30 - Distributed 256 MiB Chunk Assembly\n16:10 - Live Production Benchmarks',
      likesCount: 24500,
      commentsCount: 382,
      verified: true
    },
    {
      id: 'yt-distributed-systems',
      title: 'Distributed Video Streaming Architecture: Range Requests & Virtual Byte Assembly',
      channel: 'Systems Engineering Academy',
      channelAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      subscribers: '890K subscribers',
      views: '315K views',
      time: '5 days ago',
      duration: '24:12',
      thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      category: 'Distributed Systems',
      description: 'How to assemble multi-gigabyte video files on the fly from multiple independent S3-compatible buckets without pre-downloading the entire video file to disk.',
      likesCount: 18200,
      commentsCount: 240,
      verified: true
    },
    {
      id: 'yt-tamil-music-beats',
      title: 'Tamil Cinematic Beats & Acoustic Sessions 2026 (Official WaveMusic Live)',
      channel: 'WaveMusic Originals',
      channelAvatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100',
      subscribers: '2.8M subscribers',
      views: '1.4M views',
      time: '1 week ago',
      duration: '45:30',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      category: 'Music',
      description: 'Immerse in pure acoustic instruments, violin melodies, and bass grooves produced exclusively for WaveMusic listeners worldwide.',
      likesCount: 95400,
      commentsCount: 1420,
      verified: true
    },
    {
      id: 'yt-fullstack-guide',
      title: 'Full Stack Next.js 14 + NestJS + PostgreSQL + Redis Real-Time Architecture',
      channel: 'Modern Code Lab',
      channelAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
      subscribers: '650K subscribers',
      views: '190K views',
      time: '2 weeks ago',
      duration: '32:10',
      thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      category: 'Coding & Dev',
      description: 'Step-by-step masterclass covering microservices, RBAC security, background workers with BullMQ, and Next.js frontend optimization.',
      likesCount: 12100,
      commentsCount: 198,
      verified: true
    },
    {
      id: 'yt-hardware-review',
      title: 'Next-Gen Video Processing Workstations: NVENC Hardware Transcoding Speed Test',
      channel: 'Hardware Universe',
      channelAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
      subscribers: '1.5M subscribers',
      views: '540K views',
      time: '3 weeks ago',
      duration: '14:20',
      thumbnail: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      category: 'Tech Reviews',
      description: 'Testing 4K H.264 vs H.265 vs AV1 transcoding speeds across dedicated GPU clusters with automated FFmpeg worker pipelines.',
      likesCount: 31000,
      commentsCount: 450,
      verified: true
    },
    {
      id: 'yt-cyber-security',
      title: 'Zero Trust Object Storage: Encrypting S3 Manifests & Signed URLs in Production',
      channel: 'Security Frontier',
      channelAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100',
      subscribers: '420K subscribers',
      views: '98K views',
      time: '1 month ago',
      duration: '21:05',
      thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
      category: 'Cloudflare R2',
      description: 'Deep dive into AES-256-GCM encrypted bucket credentials, time-limited presigned URLs, and role-based access control.',
      likesCount: 7800,
      commentsCount: 88,
      verified: true
    }
  ];

  const shortsDatabase: ShortItem[] = [
    {
      id: 'sh-1',
      title: 'Cloudflare R2 Egress Cost Explained in 45 Seconds! 🚀',
      channel: 'Cloud Architecture & Systems',
      channelAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      views: '1.2M views',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      likes: 64200,
      comments: 520,
      musicTitle: 'Original Audio • Cloud Architecture'
    },
    {
      id: 'sh-2',
      title: 'Why 8 GB Bucket Quotas Prevent Billing Nightmares 💡',
      channel: 'Systems Engineering Academy',
      channelAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      views: '840K views',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      likes: 41800,
      comments: 310,
      musicTitle: 'Systems Audio • Synth Wave'
    },
    {
      id: 'sh-3',
      title: 'Instant 256 MiB Chunk Verification with SHA-256 🔥',
      channel: 'Modern Code Lab',
      channelAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
      views: '520K views',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      likes: 29000,
      comments: 180,
      musicTitle: 'Cyberpunk Beats 2026'
    }
  ];

  const categories = [
    'All',
    'Cloudflare R2',
    'Distributed Systems',
    'Music',
    'Coding & Dev',
    'Tech Reviews',
    'Tamil Songs',
    'Podcasts',
    'Live Streams',
    'Shorts'
  ];

  // Dynamic Video Feed State (synced with Cloudflare R2 and Server Database)
  const [videos, setVideos] = useState<VideoItem[]>(videoDatabase);

  // Restore session & fetch fresh video library from backend & Cloudflare R2
  useEffect(() => {
    const savedUser = localStorage.getItem('platform_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {}
    }

    fetch(`${API_BASE}/api/youtube/videos`)
      .then((r) => r.json())
      .then((serverVideos) => {
        if (Array.isArray(serverVideos) && serverVideos.length > 0) {
          const mapped: VideoItem[] = serverVideos.map((sv: any) => ({
            id: sv.id,
            title: sv.title,
            channel: sv.channel ? sv.channel.title : 'WaveMusic Creator',
            channelAvatar:
              sv.channel?.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            subscribers: sv.channel
              ? `${(sv.channel.subscriberCount / 1000).toFixed(0)}K subscribers`
              : '10K subscribers',
            views: `${sv.viewsCount || 0} views`,
            time: 'Recently uploaded',
            duration: `${Math.floor((sv.durationSeconds || 120) / 60)}:${String(
              (sv.durationSeconds || 120) % 60
            ).padStart(2, '0')}`,
            thumbnail: sv.thumbnailUrl?.startsWith('http')
              ? sv.thumbnailUrl
              : `${API_BASE}${sv.thumbnailUrl || ''}`,
            videoUrl: sv.masterPlaylistUrl?.startsWith('http')
              ? sv.masterPlaylistUrl
              : `${API_BASE}${sv.masterPlaylistUrl}`,
            category: sv.tags && sv.tags[0] ? sv.tags[0] : 'Music',
            description: sv.description || '',
            likesCount: sv.likesCount || 0,
            commentsCount: sv.commentCount || 0,
            verified: true
          }));

          setVideos((prev) => {
            const serverIds = new Set(mapped.map((m) => m.id));
            return [...mapped, ...prev.filter((p) => !serverIds.has(p.id))];
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleUploadSuccess = (sv: any) => {
    const newVideo: VideoItem = {
      id: sv.id,
      title: sv.title,
      channel: sv.channel ? sv.channel.title : 'WaveMusic Creator',
      channelAvatar:
        sv.channel?.avatarUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      subscribers: '10K subscribers',
      views: '0 views',
      time: 'Just now',
      duration: `${Math.floor((sv.durationSeconds || 120) / 60)}:${String(
        (sv.durationSeconds || 120) % 60
      ).padStart(2, '0')}`,
      thumbnail: sv.thumbnailUrl?.startsWith('http')
        ? sv.thumbnailUrl
        : `${API_BASE}${sv.thumbnailUrl || ''}`,
      videoUrl: sv.masterPlaylistUrl?.startsWith('http')
        ? sv.masterPlaylistUrl
        : `${API_BASE}${sv.masterPlaylistUrl}`,
      category: sv.tags && sv.tags[0] ? sv.tags[0] : 'Music',
      description: sv.description || '',
      likesCount: sv.likesCount || 0,
      commentsCount: 0,
      verified: true
    };
    setVideos((prev) => [newVideo, ...prev]);
    showToast(`Video "${newVideo.title}" published straight to Cloudflare R2!`);
  };

  // Filter videos
  const filteredVideos = videos.filter((v) => {
    const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Watch video handler
  const handleWatchVideo = (video: VideoItem) => {
    setActiveVideo(video);
    setCurrentView('watch');
    setIsPlaying(true);
    setVideoLikes(video.likesCount);
    setIsLiked(likedList.includes(video.id));
    setIsSavedWatchLater(watchLaterList.includes(video.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Video Player Controls
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
    setVideoCurrentTime(videoRef.current.currentTime);
    setVideoDuration(videoRef.current.duration || 0);
    setVideoProgress((videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = (parseFloat(e.target.value) / 100) * (videoRef.current.duration || 0);
    videoRef.current.currentTime = seekTime;
    setVideoProgress(parseFloat(e.target.value));
  };

  const formatDuration = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Like & Dislike
  const toggleLike = () => {
    if (!activeVideo) return;
    if (isLiked) {
      setIsLiked(false);
      setVideoLikes(prev => prev - 1);
      setLikedList(prev => prev.filter(id => id !== activeVideo.id));
    } else {
      setIsLiked(true);
      setIsDisliked(false);
      setVideoLikes(prev => prev + 1);
      setLikedList(prev => [...prev, activeVideo.id]);
      showToast('Added to Liked Videos');
    }
  };

  const toggleDislike = () => {
    if (isDisliked) {
      setIsDisliked(false);
    } else {
      setIsDisliked(true);
      if (isLiked) {
        setIsLiked(false);
        setVideoLikes(prev => prev - 1);
      }
    }
  };

  // Save to Watch Later
  const toggleWatchLater = () => {
    if (!activeVideo) return;
    if (isSavedWatchLater) {
      setIsSavedWatchLater(false);
      setWatchLaterList(prev => prev.filter(id => id !== activeVideo.id));
      showToast('Removed from Watch Later');
    } else {
      setIsSavedWatchLater(true);
      setWatchLaterList(prev => [...prev, activeVideo.id]);
      showToast('Saved to Watch Later');
    }
  };

  // Share
  const handleShare = () => {
    if (!activeVideo) return;
    const shareUrl = `${window.location.origin}/watch?v=${activeVideo.id}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('Video link copied to clipboard!');
  };

  // Post Comment
  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentInput.trim()) return;

    const newComment: CommentItem = {
      id: `c-${Date.now()}`,
      user: currentUser ? currentUser.displayName : 'Guest User',
      avatar: currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      time: 'Just now',
      text: newCommentInput.trim(),
      likes: 0
    };

    setComments(prev => [newComment, ...prev]);
    setNewCommentInput('');
    showToast('Comment posted!');
  };

  // --- Auth Handlers ---

  // Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: authLoginId.trim(),
          password: authPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      const userObj = {
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName || data.user.username,
        email: data.user.email,
        avatarUrl: data.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.username}`
      };

      setCurrentUser(userObj);
      localStorage.setItem('platform_user', JSON.stringify(userObj));
      localStorage.setItem('platform_token', data.tokens.accessToken);
      setShowSignInModal(false);
      setAuthLoginId('');
      setAuthPassword('');
      showToast(`Welcome back, ${userObj.displayName}!`);
    } catch (err: any) {
      setAuthError(err.message || 'Unable to sign in. Verify your username & password.');
    }
  };

  // Register Handler (Create Login ID)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (regPassword !== regConfirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          displayName: regDisplayName.trim() || regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Account creation failed.');
      }

      const userObj = {
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName || data.user.username,
        email: data.user.email,
        avatarUrl: data.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.username}`
      };

      setCurrentUser(userObj);
      localStorage.setItem('platform_user', JSON.stringify(userObj));
      localStorage.setItem('platform_token', data.tokens.accessToken);
      setShowRegisterModal(false);
      setRegUsername('');
      setRegDisplayName('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
      showToast(`Account created! Welcome, ${userObj.displayName}!`);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed.');
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (pwdNew !== pwdConfirm) {
      setAuthError('New passwords do not match.');
      return;
    }
    if (pwdNew.length < 6) {
      setAuthError('New password must be at least 6 characters.');
      return;
    }

    try {
      const token = localStorage.getItem('platform_token') || '';
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: currentUser?.id,
          oldPassword: pwdCurrent,
          newPassword: pwdNew
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setShowPasswordChangeModal(false);
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
      showToast('Password changed successfully!');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update password.');
    }
  };

  // Sign Out Handler
  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('platform_user');
    localStorage.removeItem('platform_token');
    setUserMenuOpen(false);
    showToast('Signed out successfully.');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f1f1f1', fontFamily: 'Roboto, Arial, sans-serif' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            zIndex: 9999,
            background: '#22c55e',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ================= 1. YOUTUBE HEADER ================= */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#0f0f0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: '56px',
          borderBottom: '1px solid #272727'
        }}
      >
        {/* Left Section: Menu & YouTube Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Menu size={22} />
          </button>

          <div
            onClick={() => { setCurrentView('home'); setActiveVideo(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}
          >
            <div
              style={{
                width: '32px',
                height: '22px',
                background: '#ff0000',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderLeft: '10px solid #fff'
                }}
              />
            </div>
            <span style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '-0.5px', color: '#fff' }}>
              YouTube
            </span>
            <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '2px', fontWeight: 500, alignSelf: 'flex-start', marginTop: '2px' }}>
              IN
            </span>
          </div>
        </div>

        {/* Center Section: Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '0 1 728px', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              maxWidth: '600px',
              background: '#121212',
              border: '1px solid #303030',
              borderRadius: '40px 0 0 40px',
              overflow: 'hidden'
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '15px',
                outline: 'none'
              }}
            />
          </div>
          <button
            style={{
              background: '#222222',
              border: '1px solid #303030',
              borderLeft: 'none',
              borderRadius: '0 40px 40px 0',
              padding: '10px 24px',
              color: '#fff',
              cursor: 'pointer',
              marginLeft: '-12px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Search size={18} />
          </button>
          <button
            title="Search with voice"
            style={{
              background: '#222',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Mic size={18} />
          </button>
        </div>

        {/* Right Section: Create, Notifications, Profile / Login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#272727',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
            <span>Create</span>
          </button>

          <button
            title="Notifications"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: '8px',
              position: 'relative',
              borderRadius: '50%'
            }}
          >
            <Bell size={20} />
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: '#cc0000',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '50%',
                padding: '1px 5px'
              }}
            >
              3
            </span>
          </button>

          {currentUser ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  background: '#f97316',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {currentUser.displayName.charAt(0).toUpperCase()}
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    width: '260px',
                    background: '#282828',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    border: '1px solid #3f3f3f',
                    zIndex: 200,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '16px', borderBottom: '1px solid #3f3f3f' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>{currentUser.displayName}</div>
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>@{currentUser.username}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{currentUser.email}</div>
                  </div>

                  <button
                    onClick={() => { setShowPasswordChangeModal(true); setUserMenuOpen(false); }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '14px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <Key size={16} />
                    <span>Change Password</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '14px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      borderTop: '1px solid #383838'
                    }}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => { setShowSignInModal(true); setAuthError(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: '1px solid #3ea6ff',
                  borderRadius: '18px',
                  padding: '6px 14px',
                  color: '#3ea6ff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <User size={16} />
                <span>Sign in</span>
              </button>
              <button
                onClick={() => { setShowRegisterModal(true); setAuthError(''); }}
                style={{
                  background: '#3ea6ff',
                  border: 'none',
                  borderRadius: '18px',
                  padding: '6px 14px',
                  color: '#000',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ================= 2. MAIN BODY (SIDEBAR + CONTENT) ================= */}
      <div style={{ display: 'flex' }}>
        {/* Left Sidebar */}
        <aside
          style={{
            width: sidebarExpanded ? '240px' : '72px',
            background: '#0f0f0f',
            height: 'calc(100vh - 56px)',
            position: 'sticky',
            top: '56px',
            overflowY: 'auto',
            padding: sidebarExpanded ? '12px' : '8px 4px',
            flexShrink: 0,
            borderRight: '1px solid #1f1f1f',
            transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Main Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <button
              onClick={() => { setCurrentView('home'); setActiveVideo(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: sidebarExpanded ? 'row' : 'column',
                gap: sidebarExpanded ? '16px' : '4px',
                padding: sidebarExpanded ? '10px 14px' : '10px 0',
                background: currentView === 'home' ? '#272727' : 'transparent',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: sidebarExpanded ? 'left' : 'center',
                width: '100%',
                fontSize: sidebarExpanded ? '14px' : '10px',
                fontWeight: currentView === 'home' ? 600 : 400
              }}
            >
              <HomeIcon size={20} />
              <span>Home</span>
            </button>

            <button
              onClick={() => { setCurrentView('shorts'); setActiveVideo(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: sidebarExpanded ? 'row' : 'column',
                gap: sidebarExpanded ? '16px' : '4px',
                padding: sidebarExpanded ? '10px 14px' : '10px 0',
                background: currentView === 'shorts' ? '#272727' : 'transparent',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: sidebarExpanded ? 'left' : 'center',
                width: '100%',
                fontSize: sidebarExpanded ? '14px' : '10px',
                fontWeight: currentView === 'shorts' ? 600 : 400
              }}
            >
              <Flame size={20} color="#ef4444" />
              <span>Shorts</span>
            </button>

            <button
              onClick={() => showToast('Subscriptions feed updated.')}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: sidebarExpanded ? 'row' : 'column',
                gap: sidebarExpanded ? '16px' : '4px',
                padding: sidebarExpanded ? '10px 14px' : '10px 0',
                background: 'transparent',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: sidebarExpanded ? 'left' : 'center',
                width: '100%',
                fontSize: sidebarExpanded ? '14px' : '10px'
              }}
            >
              <Tv size={20} />
              <span>Subscriptions</span>
            </button>
          </div>

          {sidebarExpanded && (
            <>
              <div style={{ height: '1px', background: '#272727', margin: '8px 0 12px 0' }} />

              {/* You Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                <div style={{ padding: '6px 14px', fontSize: '14px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>You</span>
                  <ChevronRight size={14} />
                </div>
                <button
                  onClick={() => { setCurrentView('watchLater'); setActiveVideo(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '10px 14px',
                    background: currentView === 'watchLater' ? '#272727' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    width: '100%'
                  }}
                >
                  <Clock size={18} />
                  <span>Watch Later ({watchLaterList.length})</span>
                </button>
                <button
                  onClick={() => { setCurrentView('liked'); setActiveVideo(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '10px 14px',
                    background: currentView === 'liked' ? '#272727' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    width: '100%'
                  }}
                >
                  <ThumbsUp size={18} />
                  <span>Liked Videos ({likedList.length})</span>
                </button>
              </div>

              <div style={{ height: '1px', background: '#272727', margin: '8px 0 12px 0' }} />

              {/* Subscriptions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                <div style={{ padding: '6px 14px', fontSize: '14px', fontWeight: 700, color: '#fff' }}>Subscriptions</div>
                {[
                  { name: 'Cloud Architecture & Systems', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
                  { name: 'Systems Engineering Academy', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
                  { name: 'WaveMusic Originals', avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100' },
                  { name: 'Modern Code Lab', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' }
                ].map((ch) => (
                  <div
                    key={ch.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    <img src={ch.avatar} alt={ch.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', background: '#272727', margin: '8px 0 12px 0' }} />

              {/* Explore Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ padding: '6px 14px', fontSize: '14px', fontWeight: 700, color: '#fff' }}>Explore</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                  <Music size={18} />
                  <span>Music</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                  <Gamepad2 size={18} />
                  <span>Gaming</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                  <Newspaper size={18} />
                  <span>News</span>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Content View Container */}
        <main style={{ flex: 1, padding: currentView === 'watch' ? '20px 24px' : '0 24px 32px 24px', overflowX: 'hidden' }}>
          {/* ================= VIEW: HOME (VIDEO FEED) ================= */}
          {currentView === 'home' && (
            <div>
              {/* Category Chips Bar */}
              <div
                style={{
                  position: 'sticky',
                  top: '56px',
                  zIndex: 90,
                  background: '#0f0f0f',
                  padding: '12px 0',
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  borderBottom: '1px solid #1f1f1f'
                }}
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: selectedCategory === cat ? '#f1f1f1' : '#272727',
                      color: selectedCategory === cat ? '#0f0f0f' : '#f1f1f1',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Video Cards Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px 16px',
                  marginTop: '20px'
                }}
              >
                {filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => handleWatchVideo(video)}
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                  >
                    {/* Thumbnail Container */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '56.25%',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#222'
                      }}
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          background: 'rgba(0,0,0,0.8)',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {video.duration}
                      </span>
                    </div>

                    {/* Metadata Row */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <img
                        src={video.channelAvatar}
                        alt={video.channel}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#fff',
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {video.title}
                        </h3>
                        <div style={{ fontSize: '12px', color: '#aaaaaa', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{video.channel}</span>
                          {video.verified && <Check size={12} color="#aaaaaa" />}
                        </div>
                        <div style={{ fontSize: '12px', color: '#aaaaaa', marginTop: '2px' }}>
                          {video.views} • {video.time}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= VIEW: WATCH (CINEMA MODE PLAYER & COMMENTS) ================= */}
          {currentView === 'watch' && activeVideo && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isCinemaMode ? '1fr' : 'minmax(0, 1fr) 400px',
                gap: '24px',
                maxWidth: '1700px',
                margin: '0 auto'
              }}
            >
              {/* Primary Video Column */}
              <div>
                {/* Cinema Player Container */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '56.25%',
                    background: '#000',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                  }}
                >
                  <video
                    ref={videoRef}
                    src={activeVideo.videoUrl}
                    poster={activeVideo.thumbnail}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                    autoPlay
                    playsInline
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                    onClick={togglePlay}
                  />

                  {/* Player Controls Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '12px 16px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    {/* Scrubber / Progress Bar */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={videoProgress}
                      onChange={handleSeek}
                      style={{
                        width: '100%',
                        cursor: 'pointer',
                        accentColor: '#ff0000',
                        height: '4px'
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button
                          onClick={togglePlay}
                          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
                        >
                          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => {
                              if (videoRef.current) {
                                videoRef.current.muted = !isMuted;
                                setIsMuted(!isMuted);
                              }
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
                          >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                          </button>
                          <span style={{ fontSize: '13px', color: '#ddd' }}>
                            {formatDuration(videoCurrentTime)} / {formatDuration(videoDuration)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <button
                          onClick={() => setIsCinemaMode(!isCinemaMode)}
                          title="Theater Mode"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isCinemaMode ? '#ff0000' : '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          <Tv size={20} />
                        </button>
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (document.fullscreenElement) {
                                document.exitFullscreen();
                              } else {
                                videoRef.current.requestFullscreen();
                              }
                            }
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
                        >
                          <Maximize size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Title */}
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '16px 0 12px 0', color: '#fff' }}>
                  {activeVideo.title}
                </h1>

                {/* Channel Bar & Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid #272727'
                  }}
                >
                  {/* Channel Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={activeVideo.channelAvatar}
                      alt={activeVideo.channel}
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{activeVideo.channel}</span>
                        {activeVideo.verified && <Check size={14} color="#aaaaaa" />}
                      </div>
                      <div style={{ fontSize: '12px', color: '#aaaaaa' }}>{activeVideo.subscribers}</div>
                    </div>
                    <button
                      onClick={() => {
                        setIsSubscribed(!isSubscribed);
                        showToast(isSubscribed ? 'Unsubscribed' : 'Subscribed with all notifications!');
                      }}
                      style={{
                        marginLeft: '12px',
                        padding: '10px 18px',
                        background: isSubscribed ? '#272727' : '#ffffff',
                        color: isSubscribed ? '#fff' : '#0f0f0f',
                        border: 'none',
                        borderRadius: '20px',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isSubscribed ? 'Subscribed' : 'Subscribe'}
                    </button>
                  </div>

                  {/* Actions (Like, Dislike, Share, Watch Later) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Joined Like / Dislike Pill */}
                    <div style={{ display: 'flex', background: '#272727', borderRadius: '20px', overflow: 'hidden' }}>
                      <button
                        onClick={toggleLike}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'transparent',
                          border: 'none',
                          color: isLiked ? '#3ea6ff' : '#fff',
                          padding: '8px 14px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600
                        }}
                      >
                        <ThumbsUp size={16} />
                        <span>{videoLikes.toLocaleString()}</span>
                      </button>
                      <div style={{ width: '1px', background: '#3f3f3f' }} />
                      <button
                        onClick={toggleDislike}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: 'transparent',
                          border: 'none',
                          color: isDisliked ? '#3ea6ff' : '#fff',
                          padding: '8px 14px',
                          cursor: 'pointer'
                        }}
                      >
                        <ThumbsDown size={16} />
                      </button>
                    </div>

                    <button
                      onClick={handleShare}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#272727',
                        border: 'none',
                        color: '#fff',
                        padding: '8px 14px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      <Share2 size={16} />
                      <span>Share</span>
                    </button>

                    <button
                      onClick={toggleWatchLater}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#272727',
                        border: 'none',
                        color: isSavedWatchLater ? '#22c55e' : '#fff',
                        padding: '8px 14px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      {isSavedWatchLater ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      <span>{isSavedWatchLater ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>

                {/* Expandable Description Box */}
                <div
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                  style={{
                    background: '#272727',
                    borderRadius: '12px',
                    padding: '14px',
                    marginTop: '16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: 1.5
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                    {activeVideo.views} • {activeVideo.time}
                  </div>
                  <div
                    style={{
                      color: '#e0e0e0',
                      whiteSpace: 'pre-line',
                      maxHeight: descriptionExpanded ? 'none' : '65px',
                      overflow: 'hidden'
                    }}
                  >
                    {activeVideo.description}
                  </div>
                  <div style={{ fontWeight: 600, color: '#aaa', marginTop: '6px', fontSize: '12px' }}>
                    {descriptionExpanded ? 'Show less' : '...more'}
                  </div>
                </div>

                {/* Interactive Real-Time Comments Section */}
                <div style={{ marginTop: '28px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '18px' }}>
                    {comments.length} Comments
                  </div>

                  {/* Add Comment Box */}
                  <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '14px', marginBottom: '28px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#f97316',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {currentUser ? currentUser.displayName.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={newCommentInput}
                        onChange={(e) => setNewCommentInput(e.target.value)}
                        placeholder="Add a comment..."
                        style={{
                          width: '100%',
                          padding: '8px 0',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid #717171',
                          color: '#fff',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setNewCommentInput('')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#aaa',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!newCommentInput.trim()}
                          style={{
                            background: newCommentInput.trim() ? '#3ea6ff' : '#272727',
                            color: newCommentInput.trim() ? '#000' : '#717171',
                            border: 'none',
                            padding: '6px 16px',
                            borderRadius: '18px',
                            fontWeight: 600,
                            cursor: newCommentInput.trim() ? 'pointer' : 'default',
                            fontSize: '13px'
                          }}
                        >
                          Comment
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Comments List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {comments.map((comment) => (
                      <div key={comment.id} style={{ display: 'flex', gap: '14px' }}>
                        <img
                          src={comment.avatar}
                          alt={comment.user}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>@{comment.user}</span>
                            <span style={{ fontSize: '12px', color: '#aaa' }}>{comment.time}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '14px', color: '#e0e0e0', lineHeight: 1.4 }}>
                            {comment.text}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
                            <button
                              onClick={() => {
                                setComments(prev =>
                                  prev.map(c =>
                                    c.id === comment.id
                                      ? { ...c, likes: c.isLiked ? c.likes - 1 : c.likes + 1, isLiked: !c.isLiked }
                                      : c
                                  )
                                );
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'transparent',
                                border: 'none',
                                color: comment.isLiked ? '#3ea6ff' : '#aaa',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              <ThumbsUp size={14} />
                              <span>{comment.likes > 0 ? comment.likes : ''}</span>
                            </button>
                            <button style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}>
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Up Next / Recommendations Sidebar */}
              {!isCinemaMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: '#fff' }}>Up Next</h3>
                  {videos
                    .filter((v) => v.id !== activeVideo.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleWatchVideo(item)}
                        style={{ display: 'flex', gap: '10px', cursor: 'pointer' }}
                      >
                        <div
                          style={{
                            position: 'relative',
                            width: '160px',
                            height: '90px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: '#222'
                          }}
                        >
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '4px',
                              background: 'rgba(0,0,0,0.8)',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '1px 4px',
                              borderRadius: '3px'
                            }}
                          >
                            {item.duration}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#fff',
                              lineHeight: 1.3,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {item.title}
                          </h4>
                          <span style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>{item.channel}</span>
                          <span style={{ fontSize: '12px', color: '#aaa' }}>{item.views}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ================= VIEW: SHORTS (VERTICAL 9:16 PLAYER) ================= */}
          {currentView === 'shorts' && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 'calc(100vh - 120px)',
                padding: '20px 0'
              }}
            >
              {(() => {
                const short = shortsDatabase[currentShortIndex];
                const isShortLiked = shortsLiked[short.id];
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                    {/* Vertical Player Box */}
                    <div
                      style={{
                        position: 'relative',
                        width: '380px',
                        height: '675px',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        background: '#000',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.8)'
                      }}
                    >
                      <video
                        src={short.videoUrl}
                        autoPlay
                        loop
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />

                      {/* Bottom Info Overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '20px 16px',
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.9))'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <img
                            src={short.channelAvatar}
                            alt={short.channel}
                            style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                          />
                          <span style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>@{short.channel}</span>
                          <button
                            style={{
                              background: '#fff',
                              color: '#000',
                              border: 'none',
                              padding: '4px 12px',
                              borderRadius: '14px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Subscribe
                          </button>
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#fff', fontWeight: 500 }}>
                          {short.title}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#aaa' }}>
                          <Music size={14} />
                          <span>{short.musicTitle}</span>
                        </div>
                      </div>
                    </div>

                    {/* Side Action Bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '20px' }}>
                      <button
                        onClick={() => {
                          setShortsLiked(prev => ({ ...prev, [short.id]: !isShortLiked }));
                          showToast(isShortLiked ? 'Unliked' : 'Liked Short');
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: isShortLiked ? '#3ea6ff' : '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ThumbsUp size={22} />
                        </div>
                        <span style={{ fontSize: '12px' }}>{isShortLiked ? short.likes + 1 : short.likes}</span>
                      </button>

                      <button
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ThumbsDown size={22} />
                        </div>
                        <span style={{ fontSize: '12px' }}>Dislike</span>
                      </button>

                      <button
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MessageSquare size={22} />
                        </div>
                        <span style={{ fontSize: '12px' }}>{short.comments}</span>
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          showToast('Short link copied!');
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Share2 size={22} />
                        </div>
                        <span style={{ fontSize: '12px' }}>Share</span>
                      </button>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <button
                          disabled={currentShortIndex === 0}
                          onClick={() => setCurrentShortIndex(prev => Math.max(0, prev - 1))}
                          style={{
                            background: '#272727',
                            border: 'none',
                            color: '#fff',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            cursor: currentShortIndex > 0 ? 'pointer' : 'default',
                            opacity: currentShortIndex > 0 ? 1 : 0.4
                          }}
                        >
                          ▲
                        </button>
                        <button
                          disabled={currentShortIndex === shortsDatabase.length - 1}
                          onClick={() => setCurrentShortIndex(prev => Math.min(shortsDatabase.length - 1, prev + 1))}
                          style={{
                            background: '#272727',
                            border: 'none',
                            color: '#fff',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            cursor: currentShortIndex < shortsDatabase.length - 1 ? 'pointer' : 'default',
                            opacity: currentShortIndex < shortsDatabase.length - 1 ? 1 : 0.4
                          }}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================= VIEW: WATCH LATER / LIKED VIDEOS ================= */}
          {(currentView === 'watchLater' || currentView === 'liked') && (
            <div style={{ padding: '24px 0' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 20px 0', color: '#fff' }}>
                {currentView === 'watchLater' ? 'Watch Later Playlist' : 'Liked Videos'}
              </h2>
              {(() => {
                const list = currentView === 'watchLater' ? watchLaterList : likedList;
                const matched = videos.filter(v => list.includes(v.id));

                if (matched.length === 0) {
                  return (
                    <div style={{ padding: '48px', textAlign: 'center', background: '#1c1c1c', borderRadius: '12px', color: '#aaa' }}>
                      <Clock size={40} style={{ margin: '0 auto 12px auto' }} />
                      <p style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 600 }}>
                        {currentView === 'watchLater' ? 'Your Watch Later list is empty' : 'No liked videos yet'}
                      </p>
                      <p style={{ margin: '8px 0 16px 0', fontSize: '13px' }}>
                        Browse videos and click "Save" or "Like" to build your library.
                      </p>
                      <button
                        onClick={() => setCurrentView('home')}
                        style={{
                          padding: '8px 16px',
                          background: '#ff0000',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '20px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Explore Videos
                      </button>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {matched.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleWatchVideo(item)}
                        style={{
                          display: 'flex',
                          gap: '16px',
                          background: '#1a1a1a',
                          padding: '12px',
                          borderRadius: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ position: 'relative', width: '220px', height: '124px', borderRadius: '8px', overflow: 'hidden' }}>
                          <img src={item.thumbnail} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                            {item.duration}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#fff' }}>{item.title}</h3>
                          <div style={{ fontSize: '13px', color: '#aaa' }}>{item.channel}</div>
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{item.views} • {item.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL: SIGN IN ================= */}
      {showSignInModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: '#212121',
              borderRadius: '16px',
              padding: '32px',
              width: '420px',
              border: '1px solid #383838'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>Sign in to YouTube</h2>
              <button
                onClick={() => setShowSignInModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Login ID / Username / Email
                </label>
                <input
                  type="text"
                  value={authLoginId}
                  onChange={(e) => setAuthLoginId(e.target.value)}
                  placeholder="e.g. vasanth or creator@platform.io"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: '#3ea6ff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '24px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Sign In
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#aaa' }}>
              Don't have a Login ID?{' '}
              <span
                onClick={() => { setShowSignInModal(false); setShowRegisterModal(true); setAuthError(''); }}
                style={{ color: '#3ea6ff', cursor: 'pointer', fontWeight: 600 }}
              >
                Create Login ID
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE LOGIN ID / REGISTER ================= */}
      {showRegisterModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: '#212121',
              borderRadius: '16px',
              padding: '32px',
              width: '440px',
              border: '1px solid #383838'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>Create Your Login ID</h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Choose Login ID / Username
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="e.g. vasanth_music"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Channel / Display Name
                </label>
                <input
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="e.g. Vasanth Visuals"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. vasanth@wavemusic.dpdns.org"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Choose password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: '#ff0000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '24px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Create Account & Join
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHANGE PASSWORD ================= */}
      {showPasswordChangeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: '#212121',
              borderRadius: '16px',
              padding: '32px',
              width: '420px',
              border: '1px solid #383838'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>Change Password</h2>
              <button
                onClick={() => setShowPasswordChangeModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  placeholder="Enter current password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '10px',
                  padding: '12px',
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '24px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REAL VIDEO UPLOAD (DIRECT TO CLOUDFLARE R2) ================= */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
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
    </div>
  );
}
