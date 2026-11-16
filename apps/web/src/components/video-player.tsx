'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Subtitles,
  RotateCcw,
  FastForward,
  Check
} from 'lucide-react';

interface VideoPlayerProps {
  title: string;
  src: string;
  poster?: string;
  audioTracks?: { language: string; label: string }[];
  subtitles?: { language: string; label: string }[];
  onClose?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  title,
  src,
  poster,
  audioTracks = [
    { language: 'en', label: 'English (Original 5.1)' },
    { language: 'es', label: 'Español' }
  ],
  subtitles = [
    { language: 'off', label: 'Off' },
    { language: 'en', label: 'English [CC]' },
    { language: 'es', label: 'Español' }
  ],
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('1080p (Auto)');
  const [selectedSub, setSelectedSub] = useState('en');
  const [selectedAudio, setSelectedAudio] = useState('en');
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [aspectMode, setAspectMode] = useState<'fit' | 'fill' | 'zoom' | 'original'>('fit');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);

  const aspectModeLabels: Record<'fit' | 'fill' | 'zoom' | 'original', string> = {
    fit: 'Fit to Screen (Aspect Ratio)',
    fill: 'Stretch (100% Full Screen)',
    zoom: 'Crop to Fill (100% Zoom)',
    original: '100% Original Size'
  };

  const cycleAspectMode = () => {
    const modes: ('fit' | 'fill' | 'zoom' | 'original')[] = ['fit', 'fill', 'zoom', 'original'];
    const nextIdx = (modes.indexOf(aspectMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setAspectMode(nextMode);

    // Show center HUD like MX Player
    setHudMessage(aspectModeLabels[nextMode]);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setHudMessage(null);
    }, 1500);

    resetHideTimer();
  };

  // 10-Second Auto-Hide Countdown
  const resetHideTimer = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowSettings(false);
      }, 10000); // Exactly 10 seconds!
    }
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, [isPlaying]);

  const qualities = ['Auto (Adaptive ABR)', '1080p (FHD)', '720p (HD)', '480p (SD)', '360p'];

  useEffect(() => {
    if (!videoRef.current || !src) return;
    const video = videoRef.current;

    let hlsInstance: any = null;

    if (src.includes('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
      } else if (typeof window !== 'undefined') {
        const attachHls = () => {
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported()) {
            hlsInstance = new Hls({ enableWorker: true });
            hlsInstance.loadSource(src);
            hlsInstance.attachMedia(video);
          }
        };

        if (!(window as any).Hls) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js';
          script.onload = attachHls;
          document.head.appendChild(script);
        } else {
          attachHls();
        }
      }
    } else {
      video.src = src;
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [src]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, onClose]);

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 120);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        videoRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '960px',
        margin: '0 auto',
        backgroundColor: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
      }}
    >
      {/* Top Header with 10s Inactivity Auto-Hide */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: '16px 24px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: controlsVisible ? 'auto' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              background: '#e50914',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px'
            }}
          >
            HLS ABR
          </span>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>{title}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Video Element with MX Player Style Aspect Ratio (Fit, Stretch 100%, Zoom) */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
        style={{
          width: '100%',
          maxHeight: '540px',
          display: 'block',
          cursor: 'pointer',
          objectFit: aspectMode === 'fit' ? 'contain' : aspectMode === 'fill' ? 'fill' : aspectMode === 'zoom' ? 'cover' : 'none'
        }}
      />

      {/* Center HUD Badge for Screen Fit (MX Player style) */}
      {hudMessage && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 35,
            pointerEvents: 'none'
          }}
        >
          📐 {hudMessage}
        </div>
      )}

      {/* Center Big Play Button Overlay */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(229, 9, 20, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 0 30px rgba(229,9,20,0.6)'
          }}
        >
          <Play size={36} color="#fff" fill="#fff" />
        </div>
      )}

      {/* Bottom Controls Bar with 10s Inactivity Auto-Hide */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: controlsVisible ? 'auto' : 'none'
        }}
      >
        {/* Progress Timeline */}
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          style={{
            width: '100%',
            accentColor: '#e50914',
            cursor: 'pointer',
            height: '4px'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={togglePlay}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime -= 10;
              }}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              title="Rewind 10s"
            >
              <RotateCcw size={18} />
            </button>

            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime += 10;
              }}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              title="Forward 10s"
            >
              <FastForward size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setIsMuted(!isMuted)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (videoRef.current) videoRef.current.volume = parseFloat(e.target.value);
                  setIsMuted(false);
                }}
                style={{ width: '60px', accentColor: '#e50914' }}
              />
            </div>

            <span style={{ fontSize: '13px', color: '#aaa' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Resolution indicator badge */}
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                background: '#1f2937',
                borderRadius: '4px',
                color: '#60a5fa',
                fontWeight: 600
              }}
            >
              {selectedQuality}
            </span>

            {/* Subtitles Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                title="Settings & Subtitles"
              >
                <Settings size={20} />
              </button>

              {showSettings && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '36px',
                    right: 0,
                    background: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    padding: '12px',
                    minWidth: '220px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 20
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
                    QUALITY (ABR)
                  </div>
                  {qualities.map((q) => (
                    <div
                      key={q}
                      onClick={() => {
                        setSelectedQuality(q);
                        setShowSettings(false);
                      }}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: selectedQuality === q ? '#e50914' : '#d1d5db',
                        background: selectedQuality === q ? '#1f2937' : 'transparent',
                        borderRadius: '4px'
                      }}
                    >
                      <span>{q}</span>
                      {selectedQuality === q && <Check size={14} />}
                    </div>
                  ))}

                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', margin: '10px 0 6px' }}>
                    SUBTITLES
                  </div>
                  {subtitles.map((s) => (
                    <div
                      key={s.language}
                      onClick={() => {
                        setSelectedSub(s.language);
                        setShowSettings(false);
                      }}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: selectedSub === s.language ? '#e50914' : '#d1d5db',
                        background: selectedSub === s.language ? '#1f2937' : 'transparent',
                        borderRadius: '4px'
                      }}
                    >
                      <span>{s.label}</span>
                      {selectedSub === s.language && <Check size={14} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MX Player Style Aspect Ratio (Fit, Stretch, Zoom) */}
            <button
              onClick={cycleAspectMode}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
                cursor: 'pointer',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Aspect Ratio (Fit to Screen, Stretch 100%, Zoom to Fill)"
            >
              <span>📐</span>
              <span>{aspectMode === 'fit' ? 'FIT' : aspectMode === 'fill' ? '100% STRETCH' : aspectMode === 'zoom' ? 'ZOOM' : '100%'}</span>
            </button>

            <button
              onClick={toggleFullscreen}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              title="Fullscreen"
            >
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
