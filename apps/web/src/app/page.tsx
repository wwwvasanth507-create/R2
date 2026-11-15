'use client';

import React, { useState, useEffect } from 'react';
import {
  Film,
  Tv,
  Youtube,
  Instagram,
  UploadCloud,
  Play,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Bell,
  Search,
  Check,
  TrendingUp,
  Clock,
  Compass,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
  Info,
  X,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Send,
  Plus
} from 'lucide-react';
import { VideoPlayer } from '../components/video-player';
import { ChunkUploader } from '../components/chunk-uploader';

type ActiveTab = 'netflix' | 'youtube' | 'instagram' | 'uploader';

interface MovieItem {
  id: string;
  title: string;
  year: string;
  rating: string;
  genre: string;
  poster: string;
  backdrop: string;
  videoUrl: string;
  description: string;
  duration: string;
  cast: string[];
}

interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  subscribers: string;
  views: string;
  time: string;
  duration: string;
  thumb: string;
  avatar: string;
  videoUrl: string;
  description: string;
  likes: number;
}

interface YouTubeShort {
  id: string;
  title: string;
  views: string;
  poster: string;
  videoUrl: string;
  likes: number;
  comments: number;
}

interface InstagramPost {
  id: string;
  user: string;
  avatar: string;
  location: string;
  image: string;
  caption: string;
  likes: number;
  comments: Array<{ user: string; text: string }>;
  isReel?: boolean;
  videoUrl?: string;
}

interface StoryItem {
  id: string;
  name: string;
  avatar: string;
  storyImage: string;
  isMine?: boolean;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('netflix');
  const [activeVideo, setActiveVideo] = useState<{ title: string; url: string; poster?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  
  // Netflix State
  const [watchlist, setWatchlist] = useState<Record<string, boolean>>({
    'mov-stellar': true
  });
  const [selectedMovieDetail, setSelectedMovieDetail] = useState<MovieItem | null>(null);

  // YouTube State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [ytLikes, setYtLikes] = useState<Record<string, { liked: boolean; count: number }>>({
    'yt-1': { liked: false, count: 1240 },
    'yt-2': { liked: true, count: 3890 }
  });
  const [ytComments, setYtComments] = useState<Array<{ user: string; text: string; time: string }>>([
    { user: 'Alex Rivera', text: 'The multi-bucket sequential spillover is genius! Zero egress cost on R2 makes this viable.', time: '2 hours ago' },
    { user: 'DevSre_Pro', text: 'Tested the 256 MiB chunking with range requests. Virtual assembly works flawlessly.', time: '5 hours ago' }
  ]);
  const [newCommentText, setNewCommentText] = useState('');

  // Instagram State
  const [igSubTab, setIgSubTab] = useState<'feed' | 'reels'>('feed');
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({
    'p-1': true
  });
  const [postLikesCount, setPostLikesCount] = useState<Record<string, number>>({
    'p-1': 3412,
    'p-2': 1890,
    'reel-1': 14200
  });
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [openPostComments, setOpenPostComments] = useState<string | null>(null);
  const [postCommentInput, setPostCommentInput] = useState('');

  // Story Timer
  useEffect(() => {
    if (!activeStory) {
      setStoryProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          setActiveStory(null);
          return 0;
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [activeStory]);

  // Catalog Data (Pristine High-Definition Creative Commons & Public CDN Streams)
  const moviesCatalog: MovieItem[] = [
    {
      id: 'mov-stellar',
      title: 'Stellar Horizon: 2099',
      year: '2026',
      rating: 'PG-13',
      genre: 'sci-fi',
      duration: '2h 22m',
      poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500',
      backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      description: 'An expedition beyond the solar boundary encounters an ancient spatial anomaly that alters time and memory. Streamed with multi-bitrate adaptive ABR and multi-channel audio.',
      cast: ['David Chen', 'Elena Rostova', 'Marcus Thorne', 'Aria Sterling']
    },
    {
      id: 'ser-neo',
      title: 'Neon Odyssey',
      year: '2025',
      rating: 'TV-MA',
      genre: 'cyberpunk',
      duration: 'Season 1 • 8 Episodes',
      poster: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500',
      backdrop: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      description: 'Under the perpetual neon rain of a synthetic metropolis, rogue detectives uncover a covert algorithmic rebellion in the cybernetic underworld.',
      cast: ['Ren Takahashi', 'Maya Lin', 'Caleb Vance']
    },
    {
      id: 'mov-cyber',
      title: 'Cyberpunk Chronicles',
      year: '2026',
      rating: 'TV-MA',
      genre: 'action',
      duration: '1h 58m',
      poster: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500',
      backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
      description: 'In an augmented society governed by autonomous neural corporations, a freelance operative takes on an impossible espionage contract.',
      cast: ['Vincent Cruz', 'Kira Sato', 'Julian Drake']
    },
    {
      id: 'mov-orbital',
      title: 'The Orbital Station',
      year: '2024',
      rating: 'PG-13',
      genre: 'drama',
      duration: '2h 10m',
      poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500',
      backdrop: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      description: 'A psychological thriller tracking the final 72 hours of an international research crew stranded in deep low-earth orbit.',
      cast: ['Sarah Jenkins', 'Arthur Campbell', 'Nadia Volkov']
    }
  ];

  const youtubeVideos: YouTubeVideo[] = [
    {
      id: 'yt-1',
      title: 'Building a Distributed 20GB Video Storage Engine with Cloudflare R2',
      channel: 'Cinematic Studios Official',
      subscribers: '145K',
      views: '12.4K views',
      time: '3 hours ago',
      duration: '14:20',
      thumb: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      description: 'Architectural walkthrough of multi-account Cloudflare R2 allocation, 8 GiB logical quotas, and RFC 7233 scatter-gather streaming.',
      likes: 1240
    },
    {
      id: 'yt-2',
      title: 'Mastering HTTP Range Requests & Virtual Multi-Bucket Reassembly',
      channel: 'Architecture Lab',
      subscribers: '89K',
      views: '28.1K views',
      time: '1 day ago',
      duration: '22:45',
      thumb: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      description: 'How to stream terabytes of media across disparate S3-compatible cloud storage buckets with bounded 64KB RAM buffers.',
      likes: 3890
    }
  ];

  const youtubeShorts: YouTubeShort[] = [
    {
      id: 'short-1',
      title: '3 Color Grading Tricks for Cinematic Contrast! #Shorts',
      views: '89.4K views',
      poster: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      likes: 6800,
      comments: 120
    },
    {
      id: 'short-2',
      title: 'How 20GB Files Upload without RAM buffering #Tech',
      views: '142K views',
      poster: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      likes: 11200,
      comments: 240
    },
    {
      id: 'short-3',
      title: 'Anamorphic Lens Flare Breakdown in 60s #Filmmaking',
      views: '45.1K views',
      poster: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      likes: 4300,
      comments: 85
    }
  ];

  const storiesList: StoryItem[] = [
    { id: 'st-0', name: 'Your Story', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', storyImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1080', isMine: true },
    { id: 'st-1', name: 'cinematic', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', storyImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1080' },
    { id: 'st-2', name: 'director_sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', storyImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080' },
    { id: 'st-3', name: 'neo_tokyo', avatar: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=100', storyImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080' }
  ];

  const [postsList, setPostsList] = useState<InstagramPost[]>([
    {
      id: 'p-1',
      user: 'cinematic_studios',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      location: 'Mojave Desert, California',
      image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1080',
      caption: 'Golden hour anamorphic rig on location in the Mojave Desert. 🌅🎥 What is your go-to cinema glass?',
      likes: 3412,
      comments: [
        { user: 'dop_marcus', text: 'Stunning flares! Is that the 50mm T2.1?' },
        { user: 'lens_junkie', text: 'The Cooke anamorphic look is unbeatable.' }
      ]
    },
    {
      id: 'p-2',
      user: 'director_sarah',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      location: 'Shibuya, Tokyo',
      image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080',
      caption: 'Location scouting for Neon Odyssey episode 4. Synthetic rain and cybernetic reflections everywhere.',
      likes: 1890,
      comments: [
        { user: 'cyber_vibe', text: 'Cannot wait for episode 4 to drop!' }
      ]
    }
  ]);

  const instagramReels: InstagramPost[] = [
    {
      id: 'reel-1',
      user: 'cinematic_studios',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      location: 'Studio Stage A',
      image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1080',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      caption: 'Cinematic lighting breakdown with a single 600W key and bounce board! 💡🎬',
      likes: 14200,
      comments: [{ user: 'film_student', text: 'So simple yet so dramatic!' }],
      isReel: true
    }
  ];

  // Actions
  const toggleWatchlist = (id: string) => {
    setWatchlist((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleTogglePostLike = (id: string) => {
    setLikedPosts((prev) => {
      const isCurrentlyLiked = !!prev[id];
      setPostLikesCount((c) => ({
        ...c,
        [id]: (c[id] || 0) + (isCurrentlyLiked ? -1 : 1)
      }));
      return { ...prev, [id]: !isCurrentlyLiked };
    });
  };

  const handleAddYtComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    setYtComments([
      { user: 'You (Production Admin)', text: newCommentText.trim(), time: 'Just now' },
      ...ytComments
    ]);
    setNewCommentText('');
  };

  const handleAddPostComment = (postId: string) => {
    if (!postCommentInput.trim()) return;
    setPostsList(postsList.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          comments: [...p.comments, { user: 'You', text: postCommentInput.trim() }]
        };
      }
      return p;
    }));
    setPostCommentInput('');
  };

  const filteredMovies = moviesCatalog.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || m.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const watchlistMovies = moviesCatalog.filter(m => !!watchlist[m.id]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#090a0f', color: '#fff' }}>
      {/* Top Universal Navbar */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(9, 10, 15, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1f2937',
          padding: '12px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          {/* Logo */}
          <div
            onClick={() => setActiveTab('netflix')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #e50914, #f97316)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                color: '#fff',
                fontSize: '18px'
              }}
            >
              M
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              MEDIA<span style={{ color: '#e50914' }}>HUB</span>
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              background: '#111827',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid #1f2937'
            }}
          >
            {[
              { id: 'netflix', label: 'Netflix', icon: Film, color: '#e50914' },
              { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#ef4444' },
              { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#ec4899' },
              { id: 'uploader', label: 'Cloudflare R2 Uploader', icon: UploadCloud, color: '#f97316' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive ? tab.color : 'transparent',
                    color: isActive ? '#fff' : '#9ca3af',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Profile Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Working Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              padding: '6px 12px'
            }}
          >
            <Search size={16} color="#9ca3af" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '13px',
                width: '180px'
              }}
            />
            {searchQuery && (
              <X size={14} color="#9ca3af" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
            )}
          </div>

          {/* Admin Dashboard Direct Shortcut */}
          <a
            href="https://admin.wavemusic.dpdns.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>R2 Console</span>
          </a>

          {/* User Profile Avatar */}
          <div
            title="Logged in as Super Admin"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#1f2937',
              border: '2px solid #374151',
              backgroundImage: 'url(https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100)',
              backgroundSize: 'cover',
              cursor: 'pointer'
            }}
          />
        </div>
      </nav>

      {/* Full-Screen Video Player Modal */}
      {activeVideo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div style={{ width: '100%', maxWidth: '980px' }}>
            <VideoPlayer
              title={activeVideo.title}
              src={activeVideo.url}
              poster={activeVideo.poster}
              onClose={() => setActiveVideo(null)}
            />
          </div>
        </div>
      )}

      {/* Instagram Story Fullscreen Viewer Modal */}
      {activeStory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '420px',
              height: '90vh',
              maxHeight: '740px',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
              backgroundImage: `url(${activeStory.storyImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '16px'
            }}
          >
            {/* Story Progress Bar */}
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px' }}>
              <div style={{ width: `${storyProgress}%`, height: '100%', background: '#fff', borderRadius: '2px', transition: 'width 0.1s linear' }} />
            </div>

            {/* Story Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundImage: `url(${activeStory.avatar})`, backgroundSize: 'cover' }} />
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{activeStory.name}</span>
                <span style={{ fontSize: '11px', color: '#d1d5db' }}>1h ago</span>
              </div>
              <button
                onClick={() => setActiveStory(null)}
                style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Story Bottom Reply */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder={`Reply to ${activeStory.name}...`}
                style={{ flex: 1, padding: '10px 16px', borderRadius: '20px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', outline: 'none' }}
              />
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <Heart size={24} />
              </button>
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <Send size={22} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movie Details Modal */}
      {selectedMovieDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            style={{
              background: '#111827',
              borderRadius: '16px',
              maxWidth: '800px',
              width: '100%',
              overflow: 'hidden',
              border: '1px solid #1f2937',
              boxShadow: '0 25px 50px rgba(0,0,0,0.9)'
            }}
          >
            <div
              style={{
                height: '320px',
                backgroundImage: `linear-gradient(to top, #111827 0%, transparent 80%), url(${selectedMovieDetail.backdrop})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                padding: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}
            >
              <span style={{ background: '#e50914', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontWeight: 700, fontSize: '12px' }}>
                4K ULTRA HD • HDR
              </span>
              <button
                onClick={() => setSelectedMovieDetail(null)}
                style={{ background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '0 32px 32px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 12px' }}>{selectedMovieDetail.title}</h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', fontSize: '13px', color: '#9ca3af' }}>
                <span style={{ color: '#46d369', fontWeight: 700 }}>98% Match</span>
                <span>{selectedMovieDetail.year}</span>
                <span style={{ border: '1px solid #4b5563', padding: '1px 6px', borderRadius: '3px' }}>{selectedMovieDetail.rating}</span>
                <span>{selectedMovieDetail.duration}</span>
                <span style={{ border: '1px solid #e50914', color: '#e50914', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>Dolby 5.1</span>
              </div>

              <p style={{ fontSize: '15px', color: '#d1d5db', lineHeight: 1.6, marginBottom: '24px' }}>
                {selectedMovieDetail.description}
              </p>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                <button
                  onClick={() => {
                    const mov = selectedMovieDetail;
                    setSelectedMovieDetail(null);
                    setActiveVideo({ title: mov.title, url: mov.videoUrl, poster: mov.backdrop });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#fff',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 28px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Play size={18} fill="#000" />
                  <span>Play</span>
                </button>

                <button
                  onClick={() => toggleWatchlist(selectedMovieDetail.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: watchlist[selectedMovieDetail.id] ? '#1f2937' : 'rgba(255,255,255,0.15)',
                    color: watchlist[selectedMovieDetail.id] ? '#46d369' : '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {watchlist[selectedMovieDetail.id] ? <Check size={18} /> : <Plus size={18} />}
                  <span>{watchlist[selectedMovieDetail.id] ? 'In Watchlist' : 'Add to Watchlist'}</span>
                </button>
              </div>

              <div style={{ borderTop: '1px solid #1f2937', paddingTop: '16px', fontSize: '13px', color: '#9ca3af' }}>
                <span style={{ color: '#6b7280' }}>Starring: </span>
                <span>{selectedMovieDetail.cast.join(', ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main style={{ flex: 1, padding: '24px 32px' }}>
        {/* ================= NETFLIX EXPERIENCE ================= */}
        {activeTab === 'netflix' && (
          <div>
            {/* Hero Billboard */}
            <div
              style={{
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                minHeight: '440px',
                backgroundImage:
                  'linear-gradient(to right, rgba(9,10,15,0.95) 30%, transparent 80%), url(https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                padding: '48px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                marginBottom: '32px'
              }}
            >
              <div style={{ maxWidth: '580px' }}>
                <span
                  style={{
                    background: '#e50914',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px'
                  }}
                >
                  FEATURED SCI-FI EPIC
                </span>
                <h1 style={{ fontSize: '42px', fontWeight: 800, margin: '12px 0 16px', color: '#fff', lineHeight: 1.1 }}>
                  Stellar Horizon: 2099
                </h1>
                <p style={{ fontSize: '15px', color: '#d1d5db', lineHeight: 1.5, marginBottom: '24px' }}>
                  An expedition beyond the solar boundary encounters an ancient spatial anomaly that alters time and
                  memory. Streamed with multi-bitrate adaptive ABR and multi-channel audio.
                </p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    onClick={() =>
                      setActiveVideo({
                        title: 'Stellar Horizon: 2099',
                        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
                        poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280'
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#fff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Play size={18} fill="#000" />
                    <span>Watch Now</span>
                  </button>
                  <button
                    onClick={() => toggleWatchlist('mov-stellar')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: watchlist['mov-stellar'] ? '#1f2937' : 'rgba(255,255,255,0.2)',
                      color: watchlist['mov-stellar'] ? '#46d369' : '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {watchlist['mov-stellar'] ? <Check size={18} /> : <Plus size={18} />}
                    <span>{watchlist['mov-stellar'] ? 'In Watchlist' : '+ Add to Watchlist'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { id: 'all', label: 'All Titles' },
                { id: 'sci-fi', label: 'Sci-Fi' },
                { id: 'cyberpunk', label: 'Cyberpunk' },
                { id: 'action', label: 'Action' },
                { id: 'drama', label: 'Drama' }
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGenre(g.id)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '20px',
                    border: 'none',
                    background: selectedGenre === g.id ? '#e50914' : '#111827',
                    color: selectedGenre === g.id ? '#fff' : '#9ca3af',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Watchlist Section (if items saved) */}
            {watchlistMovies.length > 0 && (
              <div style={{ marginBottom: '36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Bookmark size={18} color="#e50914" />
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>My Watchlist</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {watchlistMovies.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMovieDetail(item)}
                      style={{
                        background: '#111827',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid #1f2937',
                        cursor: 'pointer'
                      }}
                    >
                      <div
                        style={{
                          height: '280px',
                          backgroundImage: `url(${item.poster})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      <div style={{ padding: '12px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{item.year} • {item.rating}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Continue Watching Section */}
            <div style={{ marginBottom: '36px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Clock size={18} color="#e50914" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Continue Watching</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                <div
                  style={{
                    background: '#111827',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #1f2937',
                    cursor: 'pointer'
                  }}
                  onClick={() =>
                    setActiveVideo({
                      title: 'Neon Odyssey: S1 E1 Signal in the Void',
                      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
                      poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800'
                    })
                  }
                >
                  <div
                    style={{
                      height: '160px',
                      backgroundImage: 'url(https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800)',
                      backgroundSize: 'cover',
                      position: 'relative'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Play size={32} color="#fff" />
                    </div>
                  </div>
                  <div style={{ height: '4px', background: '#374151' }}>
                    <div style={{ width: '65%', height: '100%', background: '#e50914' }} />
                  </div>
                  <div style={{ padding: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>Neon Odyssey: S1 E1</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>35m left of 54m</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtered Movies Grid */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <TrendingUp size={18} color="#e50914" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Movies & Web Series</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {filteredMovies.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedMovieDetail(item)}
                    style={{
                      background: '#111827',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid #1f2937',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <div
                      style={{
                        height: '280px',
                        backgroundImage: `url(${item.poster})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    />
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{item.title}</div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                        <span>{item.year}</span>
                        <span>•</span>
                        <span style={{ border: '1px solid #374151', padding: '1px 4px', borderRadius: '3px' }}>
                          {item.rating}
                        </span>
                        <span>•</span>
                        <span style={{ color: '#60a5fa' }}>4K HDR</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= YOUTUBE EXPERIENCE ================= */}
        {activeTab === 'youtube' && (
          <div>
            {/* Category Chips */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
              {['All', 'Distributed Systems', 'Cloudflare R2', 'Camera Gear', 'Color Grading', 'Shorts', 'Podcasts'].map(
                (cat, idx) => (
                  <button
                    key={cat}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: idx === 0 ? '#fff' : '#1f2937',
                      color: idx === 0 ? '#000' : '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>

            {/* YouTube Shorts Shelf */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                  SHORTS
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Vertical Shorts Feed</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                {youtubeShorts.map((s) => (
                  <div
                    key={s.id}
                    onClick={() =>
                      setActiveVideo({
                        title: s.title,
                        url: s.videoUrl,
                        poster: s.poster
                      })
                    }
                    style={{
                      height: '320px',
                      borderRadius: '12px',
                      backgroundImage: `url(${s.poster})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: '1px solid #1f2937'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 10%, transparent 60%)',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{s.title}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{s.views}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Standard YouTube Video Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px', marginBottom: '40px' }}>
              {youtubeVideos.map((v) => (
                <div
                  key={v.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setActiveVideo({
                      title: v.title,
                      url: v.videoUrl,
                      poster: v.thumb
                    })
                  }
                >
                  <div
                    style={{
                      height: '200px',
                      borderRadius: '12px',
                      backgroundImage: `url(${v.thumb})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      marginBottom: '12px'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.85)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {v.duration}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundImage: `url(${v.avatar})`,
                        backgroundSize: 'cover',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{v.title}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{v.channel}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                        {v.views} • {v.time}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Creator Channel Showcase & Real-Time Interactive Comments */}
            <div
              style={{
                background: '#111827',
                borderRadius: '16px',
                border: '1px solid #1f2937',
                padding: '24px'
              }}
            >
              {/* Channel Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundImage: 'url(https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150)', backgroundSize: 'cover' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Cinematic Studios Official</h3>
                    <div style={{ fontSize: '13px', color: '#9ca3af' }}>{isSubscribed ? '145,001 subscribers' : '145,000 subscribers'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setYtLikes((prev) => {
                        const cur = prev['yt-1'] || { liked: false, count: 1240 };
                        return {
                          ...prev,
                          'yt-1': { liked: !cur.liked, count: cur.count + (cur.liked ? -1 : 1) }
                        };
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: ytLikes['yt-1']?.liked ? '#ef4444' : '#1f2937',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <ThumbsUp size={16} />
                    <span>{ytLikes['yt-1']?.count.toLocaleString()}</span>
                  </button>

                  <button
                    onClick={() => setIsSubscribed(!isSubscribed)}
                    style={{
                      background: isSubscribed ? '#374151' : '#fff',
                      color: isSubscribed ? '#9ca3af' : '#000',
                      border: 'none',
                      padding: '10px 24px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {isSubscribed ? <UserCheck size={16} /> : null}
                    <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
                  </button>
                </div>
              </div>

              {/* Real-time Comments Section */}
              <div style={{ borderTop: '1px solid #1f2937', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px' }}>{ytComments.length} Comments</h4>

                {/* Comment Input */}
                <form onSubmit={handleAddYtComment} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundImage: 'url(https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100)', backgroundSize: 'cover', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    style={{
                      flex: 1,
                      background: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Comment
                  </button>
                </form>

                {/* Comments List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {ytComments.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                        {c.user[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>
                          {c.user} <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 400, marginLeft: '6px' }}>{c.time}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#d1d5db', marginTop: '4px', lineHeight: 1.4 }}>
                          {c.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= INSTAGRAM EXPERIENCE ================= */}
        {activeTab === 'instagram' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Feed vs Reels Switcher */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
              <button
                onClick={() => setIgSubTab('feed')}
                style={{
                  background: igSubTab === 'feed' ? '#ec4899' : '#111827',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 24px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Feed
              </button>
              <button
                onClick={() => setIgSubTab('reels')}
                style={{
                  background: igSubTab === 'reels' ? '#ec4899' : '#111827',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 24px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Reels (Vertical)
              </button>
            </div>

            {/* Active Stories Carousel */}
            {igSubTab === 'feed' && (
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px',
                  background: '#111827',
                  borderRadius: '16px',
                  border: '1px solid #1f2937',
                  marginBottom: '24px',
                  overflowX: 'auto'
                }}
              >
                {storiesList.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setActiveStory(s)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        padding: '3px',
                        background: s.isMine ? '#374151' : 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          backgroundImage: `url(${s.avatar})`,
                          backgroundSize: 'cover',
                          border: '2px solid #111827'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: '#9ca3af', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Instagram Posts Feed */}
            {igSubTab === 'feed' && (
              <div>
                {postsList.map((post) => {
                  const isLiked = !!likedPosts[post.id];
                  const likes = postLikesCount[post.id] || post.likes;
                  const isCommentsOpen = openPostComments === post.id;
                  return (
                    <div
                      key={post.id}
                      style={{
                        background: '#111827',
                        border: '1px solid #1f2937',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        marginBottom: '24px'
                      }}
                    >
                      {/* Post Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundImage: `url(${post.avatar})`,
                              backgroundSize: 'cover'
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{post.user}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{post.location}</div>
                          </div>
                        </div>
                      </div>

                      {/* Post Image */}
                      <div
                        onDoubleClick={() => handleTogglePostLike(post.id)}
                        style={{
                          height: '420px',
                          backgroundImage: `url(${post.image})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          cursor: 'pointer'
                        }}
                      />

                      {/* Post Actions */}
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                              onClick={() => handleTogglePostLike(post.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <Heart size={22} color={isLiked ? '#ef4444' : '#fff'} fill={isLiked ? '#ef4444' : 'none'} />
                            </button>
                            <button
                              onClick={() => setOpenPostComments(isCommentsOpen ? null : post.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <MessageCircle size={22} color="#fff" />
                            </button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              <Share2 size={22} color="#fff" />
                            </button>
                          </div>
                          <Bookmark size={22} color="#fff" style={{ cursor: 'pointer' }} />
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                          {likes.toLocaleString()} likes
                        </div>

                        <div style={{ fontSize: '13px', color: '#e5e7eb', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 700, marginRight: '6px' }}>{post.user}</span>
                          {post.caption}
                        </div>

                        {/* Comments Drawer */}
                        <div
                          onClick={() => setOpenPostComments(isCommentsOpen ? null : post.id)}
                          style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', cursor: 'pointer' }}
                        >
                          {isCommentsOpen ? 'Hide comments' : `View all ${post.comments.length} comments`}
                        </div>

                        {isCommentsOpen && (
                          <div style={{ marginTop: '12px', borderTop: '1px solid #1f2937', paddingTop: '8px' }}>
                            {post.comments.map((c, idx) => (
                              <div key={idx} style={{ fontSize: '12px', marginBottom: '6px' }}>
                                <span style={{ fontWeight: 700, color: '#fff', marginRight: '6px' }}>{c.user}</span>
                                <span style={{ color: '#d1d5db' }}>{c.text}</span>
                              </div>
                            ))}

                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <input
                                type="text"
                                placeholder="Add a comment..."
                                value={postCommentInput}
                                onChange={(e) => setPostCommentInput(e.target.value)}
                                style={{
                                  flex: 1,
                                  background: '#1f2937',
                                  border: '1px solid #374151',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  color: '#fff',
                                  fontSize: '12px',
                                  outline: 'none'
                                }}
                              />
                              <button
                                onClick={() => handleAddPostComment(post.id)}
                                style={{
                                  background: '#ec4899',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Post
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Instagram Reels Section */}
            {igSubTab === 'reels' && (
              <div>
                {instagramReels.map((reel) => (
                  <div
                    key={reel.id}
                    style={{
                      position: 'relative',
                      height: '620px',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      marginBottom: '24px',
                      border: '1px solid #1f2937',
                      background: '#000'
                    }}
                  >
                    <video
                      src={reel.videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 10%, transparent 60%)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        padding: '20px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundImage: `url(${reel.avatar})`, backgroundSize: 'cover' }} />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{reel.user}</span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#e5e7eb', margin: '0 0 12px' }}>{reel.caption}</p>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleTogglePostLike(reel.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                        >
                          <Heart size={20} color={likedPosts[reel.id] ? '#ef4444' : '#fff'} fill={likedPosts[reel.id] ? '#ef4444' : 'none'} />
                          <span style={{ fontSize: '12px' }}>{(postLikesCount[reel.id] || reel.likes).toLocaleString()}</span>
                        </button>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                          <MessageCircle size={20} color="#fff" />
                          <span style={{ fontSize: '12px' }}>{reel.comments.length}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= CLOUDFLARE R2 UPLOADER ================= */}
        {activeTab === 'uploader' && <ChunkUploader />}
      </main>
    </div>
  );
}
