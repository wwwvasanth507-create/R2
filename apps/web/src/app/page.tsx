'use client';

import React, { useState } from 'react';
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
  UserCheck
} from 'lucide-react';
import { VideoPlayer } from '../components/video-player';
import { ChunkUploader } from '../components/chunk-uploader';

type ActiveTab = 'netflix' | 'youtube' | 'instagram' | 'uploader';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('netflix');
  const [activeVideo, setActiveVideo] = useState<{ title: string; url: string; poster?: string } | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [postLikesCount, setPostLikesCount] = useState<Record<string, number>>({
    'p-1': 3412,
    'p-2': 1890
  });

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
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
              { id: 'uploader', label: 'R2 Uploader (20GB)', icon: UploadCloud, color: '#f97316' }
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

        {/* User Profile & Notifications */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer'
            }}
          >
            <Search size={18} />
          </button>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer'
            }}
          >
            <Bell size={18} />
          </button>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#1f2937',
              border: '2px solid #374151',
              backgroundImage: 'url(https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100)',
              backgroundSize: 'cover'
            }}
          />
        </div>
      </nav>

      {/* Video Modal Player (if active) */}
      {activeVideo && (
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
          <div style={{ width: '100%', maxWidth: '960px' }}>
            <VideoPlayer
              title={activeVideo.title}
              src={activeVideo.url}
              poster={activeVideo.poster}
              onClose={() => setActiveVideo(null)}
            />
          </div>
        </div>
      )}

      {/* Main Content Areas */}
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
                marginBottom: '40px'
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
                  memory. Streamed via adaptive multi-resolution HLS with Dolby 5.1 audio.
                </p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    onClick={() =>
                      setActiveVideo({
                        title: 'Stellar Horizon: 2099',
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
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
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    + Add to Watchlist
                  </button>
                </div>
              </div>
            </div>

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
                      title: 'Neon Odyssey - S1:E1 Signal in the Void',
                      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
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

            {/* Trending Movies Grid */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <TrendingUp size={18} color="#e50914" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Trending Movies & Web Series</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                  {
                    title: 'Stellar Horizon: 2099',
                    year: '2026',
                    rating: 'PG-13',
                    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500'
                  },
                  {
                    title: 'Neon Odyssey',
                    year: '2025',
                    rating: 'TV-MA',
                    poster: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500'
                  },
                  {
                    title: 'Cyberpunk Chronicles',
                    year: '2026',
                    rating: 'TV-MA',
                    poster: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500'
                  },
                  {
                    title: 'The Orbital Station',
                    year: '2024',
                    rating: 'PG-13',
                    poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500'
                  }
                ].map((item) => (
                  <div
                    key={item.title}
                    onClick={() =>
                      setActiveVideo({
                        title: item.title,
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                        poster: item.poster
                      })
                    }
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
                        <span style={{ color: '#60a5fa' }}>4K HLS</span>
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
                {[
                  {
                    title: '3 Color Grading Tricks for Cinema Look!',
                    views: '89.4K views',
                    poster: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500'
                  },
                  {
                    title: 'How 20GB Files Upload without RAM buffering',
                    views: '142K views',
                    poster: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500'
                  },
                  {
                    title: 'Anamorphic Lens Flare Breakdown',
                    views: '45.1K views',
                    poster: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500'
                  }
                ].map((s) => (
                  <div
                    key={s.title}
                    onClick={() =>
                      setActiveVideo({
                        title: s.title,
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {[
                {
                  id: 'yt-1',
                  title: 'Building a Distributed 20GB Video Storage Engine with Cloudflare R2',
                  channel: 'Cinematic Studios Official',
                  views: '12.4K views',
                  time: '3 hours ago',
                  duration: '14:20',
                  thumb: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
                  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'
                },
                {
                  id: 'yt-2',
                  title: 'Mastering HTTP Range Requests & Virtual Multi-Bucket Reassembly',
                  channel: 'Architecture Lab',
                  views: '28.1K views',
                  time: '1 day ago',
                  duration: '22:45',
                  thumb: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800',
                  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                }
              ].map((v) => (
                <div
                  key={v.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setActiveVideo({
                      title: v.title,
                      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                      poster: v.thumb
                    })
                  }
                >
                  <div
                    style={{
                      height: '190px',
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
                        background: 'rgba(0,0,0,0.8)',
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
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundImage: `url(${v.avatar})`,
                        backgroundSize: 'cover',
                        flexShrink: 0
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{v.title}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{v.channel}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {v.views} • {v.time}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= INSTAGRAM EXPERIENCE ================= */}
        {activeTab === 'instagram' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Active Stories Carousel */}
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
              {[
                { name: 'Your Story', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', isMine: true },
                { name: 'cinematic', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
                { name: 'director_sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
                { name: 'neo_tokyo', avatar: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=100' }
              ].map((s) => (
                <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
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

            {/* Instagram Posts Feed */}
            {[
              {
                id: 'p-1',
                user: 'cinematic_studios',
                avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
                location: 'Mojave Desert, California',
                image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1080',
                caption: 'Golden hour anamorphic rig test on location in the desert. 🌅🎥 What is your go-to cinema glass?',
                comments: 89
              },
              {
                id: 'p-2',
                user: 'director_sarah',
                avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
                location: 'Tokyo, Japan',
                image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080',
                caption: 'Location scouting for Neon Odyssey episode 4. Synthetic rain and neon everywhere.',
                comments: 42
              }
            ].map((post) => {
              const isLiked = !!likedPosts[post.id];
              const likes = postLikesCount[post.id] || 0;
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
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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

                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', cursor: 'pointer' }}>
                      View all {post.comments} comments
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= CLOUDFLARE R2 UPLOADER ================= */}
        {activeTab === 'uploader' && <ChunkUploader />}
      </main>
    </div>
  );
}
