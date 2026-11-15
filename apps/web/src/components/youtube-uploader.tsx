'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  Image as ImageIcon,
  Sparkles,
  Globe,
  Lock,
  Link as LinkIcon,
  X,
  Play,
  Loader2,
  ArrowRight,
  HardDrive,
  Film,
  Tag,
  AlignLeft,
  Check
} from 'lucide-react';

interface YouTubeUploaderProps {
  onClose: () => void;
  onUploadSuccess: (video: any) => void;
  onWatchVideo: (video: any) => void;
  apiBase: string;
}

export const YouTubeUploader: React.FC<YouTubeUploaderProps> = ({
  onClose,
  onUploadSuccess,
  onWatchVideo,
  apiBase
}) => {
  // Upload lifecycle: 'select' -> 'details' -> 'uploading' -> 'success'
  const [step, setStep] = useState<'select' | 'details' | 'uploading' | 'success'>('select');

  // Selected File & Extracted Metadata
  const [file, setFile] = useState<File | null>(null);
  const [fileSizeFormatted, setFileSizeFormatted] = useState('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [isAutoThumbnail, setIsAutoThumbnail] = useState(true);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setSelectedCategory] = useState('Music');
  const [tags, setTags] = useState('WaveMusic, Trending, 4K');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PUBLIC');
  const [isShort, setIsShort] = useState(false);

  // Upload Progress
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [transferredText, setTransferredText] = useState('');
  const [remainingText, setRemainingText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedVideo, setUploadedVideo] = useState<any>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Hidden file inputs
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const categories = [
    'Music',
    'Gaming',
    'Tech',
    'News',
    'Movies',
    'Entertainment',
    'Education',
    'Sports',
    'Travel'
  ];

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle Video File Selection
  const handleFileChosen = (selectedFile: File) => {
    setFile(selectedFile);
    setFileSizeFormatted(formatBytes(selectedFile.size));

    // Auto-fill Title from filename
    const cleanName = selectedFile.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .trim();
    setTitle(cleanName || 'My Uploaded Video');

    // Attempt video thumbnail and duration auto-extraction
    try {
      const videoElem = document.createElement('video');
      videoElem.preload = 'metadata';
      videoElem.src = URL.createObjectURL(selectedFile);
      videoElem.muted = true;
      videoElem.playsInline = true;

      videoElem.onloadedmetadata = () => {
        const dur = videoElem.duration || 0;
        setVideoDuration(dur);
        if (dur > 0 && dur < 60) {
          setIsShort(true);
        }
        // Seek to 1 second for thumbnail
        videoElem.currentTime = Math.min(1.0, dur > 1 ? 1.0 : dur / 2);
      };

      videoElem.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoElem.videoWidth || 640;
          canvas.height = videoElem.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            setThumbnailUrl(dataUrl);
            setIsAutoThumbnail(true);
          }
        } catch {
          // Ignored
        } finally {
          URL.revokeObjectURL(videoElem.src);
        }
      };

      videoElem.onerror = () => {
        URL.revokeObjectURL(videoElem.src);
        // Fallback placeholder thumbnail
        setThumbnailUrl('https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800');
      };
    } catch {
      setThumbnailUrl('https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800');
    }

    setStep('details');
  };

  // Custom Thumbnail File Picker
  const handleCustomThumbnailChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const thumbFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setThumbnailUrl(event.target.result as string);
          setIsAutoThumbnail(false);
        }
      };
      reader.readAsDataURL(thumbFile);
    }
  };

  // Start Real Direct-to-R2 Upload
  const handleStartUpload = () => {
    if (!file) return;
    if (!title.trim()) {
      setErrorMessage('Please enter a title for your video.');
      return;
    }

    setErrorMessage('');
    setStep('uploading');
    setUploadPercent(0);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    const queryParams = new URLSearchParams({
      title: title.trim(),
      category: category,
      isShort: String(isShort),
      visibility: visibility,
      filename: file.name
    });

    xhr.open('POST', `${apiBase}/api/videos/upload?${queryParams.toString()}`);

    // Set request headers
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.setRequestHeader('x-title', encodeURIComponent(title.trim()));
    xhr.setRequestHeader('x-description', encodeURIComponent(description.trim()));
    xhr.setRequestHeader('x-category', encodeURIComponent(category));
    xhr.setRequestHeader('x-tags', encodeURIComponent(tags));
    xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
    xhr.setRequestHeader('x-duration', String(Math.round(videoDuration || 120)));
    xhr.setRequestHeader('x-is-short', String(isShort));
    xhr.setRequestHeader('x-visibility', visibility);

    // Send thumbnail data URL if available and reasonable length
    if (thumbnailUrl && thumbnailUrl.length < 500000) {
      xhr.setRequestHeader('x-thumbnail-url', encodeURIComponent(thumbnailUrl));
    }

    // Attach Bearer token if user is signed in
    try {
      const token = localStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
    } catch {}

    let lastLoaded = 0;
    let lastTime = Date.now();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadPercent(percent);

        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        if (timeDiff >= 0.5) {
          const bytesDiff = e.loaded - lastLoaded;
          const speedBps = bytesDiff / timeDiff;
          const speedMbps = (speedBps / (1024 * 1024)).toFixed(1);
          setUploadSpeed(`${speedMbps} MB/s`);

          const remainingBytes = e.total - e.loaded;
          const remainingSecs = speedBps > 0 ? Math.round(remainingBytes / speedBps) : 0;
          setRemainingText(remainingSecs > 0 ? `${remainingSecs}s remaining` : 'Finalizing...');

          lastLoaded = e.loaded;
          lastTime = now;
        }

        setTransferredText(`${formatBytes(e.loaded)} of ${formatBytes(e.total)}`);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          setUploadedVideo(response.video);
          onUploadSuccess(response.video);
          setStep('success');
        } catch {
          setErrorMessage('Video uploaded, but failed to parse server response.');
          setStep('details');
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          setErrorMessage(errData.error || `Upload failed with status code ${xhr.status}`);
        } catch {
          setErrorMessage(`Upload failed with status code ${xhr.status}`);
        }
        setStep('details');
      }
    };

    xhr.onerror = () => {
      setErrorMessage('Network error during upload. Please check connection and try again.');
      setStep('details');
    };

    // Send the raw video stream bit-for-bit directly to R2 bucket!
    xhr.send(file);
  };

  return (
    <div
      style={{
        background: '#212121',
        borderRadius: '16px',
        padding: '24px 28px',
        width: '680px',
        maxWidth: '92vw',
        maxHeight: '88vh',
        overflowY: 'auto',
        color: '#fff',
        fontFamily: 'Roboto, Arial, sans-serif',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
        border: '1px solid #383838'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          borderBottom: '1px solid #383838',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Film size={22} color="#ff0000" />
          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700 }}>
            {step === 'select' && 'Upload Video'}
            {step === 'details' && 'Video Details'}
            {step === 'uploading' && 'Uploading Video to Cloudflare R2'}
            {step === 'success' && 'Video Published Successfully!'}
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '18px',
            color: '#f87171',
            fontSize: '13px'
          }}
        >
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: SELECT FILE */}
      {step === 'select' && (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChosen(e.dataTransfer.files[0]);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              border: `2px dashed ${isDragging ? '#ff0000' : '#444'}`,
              borderRadius: '16px',
              background: isDragging ? 'rgba(255,0,0,0.05)' : '#181818',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => videoInputRef.current?.click()}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: '#282828',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px'
              }}
            >
              <UploadCloud size={36} color="#aaa" />
            </div>

            <p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600, color: '#fff' }}>
              Drag and drop video files to upload
            </p>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#888' }}>
              Supports MP4, MKV, MOV, AVI, WEBM, FLV, TS, WMV and all standard video formats
            </p>

            <button
              type="button"
              style={{
                background: '#3ea6ff',
                color: '#0f0f0f',
                fontWeight: 600,
                fontSize: '14px',
                padding: '10px 24px',
                borderRadius: '24px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              SELECT FILES
            </button>

            <input
              ref={videoInputRef}
              type="file"
              accept="video/*,.mp4,.mkv,.mov,.avi,.webm,.flv,.ts,.wmv,.m4v"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChosen(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* R2 Multi-Account Storage Policy Callout */}
          <div
            style={{
              marginTop: '20px',
              padding: '14px 18px',
              background: '#181818',
              borderRadius: '10px',
              border: '1px solid #333',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <HardDrive size={22} color="#3ea6ff" />
            <div style={{ fontSize: '12px', color: '#aaa' }}>
              <strong style={{ color: '#fff' }}>Cloudflare R2 Direct Storage Engine:</strong> Uploaded video is
              streamed straight to active 8 GiB quota buckets with HTTP Range playback and zero egress fees.
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: METADATA DETAILS */}
      {step === 'details' && (
        <div>
          {/* File summary pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#181818',
              padding: '10px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #333'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileVideo size={20} color="#3ea6ff" />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>{file?.name}</span>
              <span style={{ fontSize: '12px', color: '#888' }}>({fileSizeFormatted})</span>
            </div>
            <button
              onClick={() => setStep('select')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#3ea6ff',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Change File
            </button>
          </div>

          {/* Title Field */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#aaa', marginBottom: '6px' }}>
              Title (required)
            </label>
            <input
              type="text"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a title that describes your video"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#181818',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {title.length}/100
            </div>
          </div>

          {/* Description Field */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#aaa', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers about your video (add #hashtags, links, or context)"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#181818',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical'
              }}
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {description.length}/2000
            </div>
          </div>

          {/* Thumbnail Section */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#aaa', marginBottom: '8px' }}>
              Thumbnail
            </label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div
                style={{
                  width: '160px',
                  height: '90px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#181818',
                  border: '1px solid #444',
                  position: 'relative'
                }}
              >
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#666'
                    }}
                  >
                    <ImageIcon size={28} />
                  </div>
                )}
                {isAutoThumbnail && thumbnailUrl && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '4px',
                      background: 'rgba(0,0,0,0.7)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: '#3ea6ff'
                    }}
                  >
                    Auto-Captured
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#888' }}>
                  Auto-captured from frame 1 of your video. You can also upload a custom image.
                </p>
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  style={{
                    background: '#282828',
                    border: '1px solid #444',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '8px 14px',
                    borderRadius: '18px',
                    cursor: 'pointer'
                  }}
                >
                  Upload Custom Thumbnail
                </button>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleCustomThumbnailChosen}
                />
              </div>
            </div>
          </div>

          {/* Category Chips */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#aaa', marginBottom: '8px' }}>
              Category
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: category === cat ? 'none' : '1px solid #444',
                    background: category === cat ? '#fff' : '#282828',
                    color: category === cat ? '#0f0f0f' : '#fff'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#aaa', marginBottom: '6px' }}>
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. WaveMusic, 4K, Tamil, Live"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#181818',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          {/* YouTube Short Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#181818',
              borderRadius: '8px',
              marginBottom: '18px',
              border: '1px solid #333'
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Publish as YouTube Short</div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                Vertical format video under 60 seconds
              </div>
            </div>
            <input
              type="checkbox"
              checked={isShort}
              onChange={(e) => setIsShort(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ff0000' }}
            />
          </div>

          {/* Visibility Radios */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#aaa', marginBottom: '8px' }}>
              Visibility
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { id: 'PUBLIC', label: 'Public', desc: 'Everyone can watch', icon: Globe },
                { id: 'UNLISTED', label: 'Unlisted', desc: 'Anyone with link', icon: LinkIcon },
                { id: 'PRIVATE', label: 'Private', desc: 'Only you can watch', icon: Lock }
              ].map((vis) => {
                const Icon = vis.icon;
                const isSelected = visibility === vis.id;
                return (
                  <div
                    key={vis.id}
                    onClick={() => setVisibility(vis.id as any)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(62, 166, 255, 0.1)' : '#181818',
                      border: `1px solid ${isSelected ? '#3ea6ff' : '#333'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Icon size={16} color={isSelected ? '#3ea6ff' : '#aaa'} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#3ea6ff' : '#fff' }}>
                        {vis.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{vis.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#aaa',
                padding: '10px 18px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartUpload}
              style={{
                background: '#3ea6ff',
                color: '#0f0f0f',
                fontWeight: 600,
                fontSize: '14px',
                padding: '10px 24px',
                borderRadius: '24px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              Upload & Publish Video
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REAL-TIME STREAMING PROGRESS */}
      {step === 'uploading' && (
        <div style={{ padding: '24px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(62, 166, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <Loader2 size={32} color="#3ea6ff" className="animate-spin" />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              Streaming Straight to Cloudflare R2
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#aaa' }}>
              Target Bucket: <strong style={{ color: '#fff' }}>wavemusic-r2-media-1</strong> (8 GiB logical quota)
            </p>
          </div>

          {/* Big Percentage */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#3ea6ff' }}>{uploadPercent}%</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{uploadSpeed || 'Connecting...'}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>{remainingText}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: '10px',
              borderRadius: '5px',
              background: '#333',
              overflow: 'hidden',
              marginBottom: '12px'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${uploadPercent}%`,
                background: 'linear-gradient(90deg, #ff0000, #3ea6ff)',
                borderRadius: '5px',
                transition: 'width 0.2s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa' }}>
            <span>{transferredText}</span>
            <span>Calculating SHA-256 on the fly...</span>
          </div>
        </div>
      )}

      {/* STEP 4: SUCCESS & INSTANT STREAM */}
      {step === 'success' && uploadedVideo && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}
          >
            <CheckCircle2 size={38} color="#22c55e" />
          </div>

          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#fff' }}>
            Video Successfully Published!
          </h3>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#aaa' }}>
            Stored in Cloudflare R2 bucket and registered in PostgreSQL database.
          </p>

          {/* Video Preview Card */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              background: '#181818',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #333',
              textAlign: 'left',
              marginBottom: '24px'
            }}
          >
            <div
              style={{
                width: '140px',
                height: '80px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#000',
                flexShrink: 0
              }}
            >
              <img
                src={uploadedVideo.thumbnailUrl || thumbnailUrl}
                alt="Thumbnail"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {uploadedVideo.title}
              </h4>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                Channel: {uploadedVideo.channel?.title || 'WaveMusic Creator'}
              </div>
              <div style={{ fontSize: '12px', color: '#3ea6ff' }}>
                Stream: {uploadedVideo.masterPlaylistUrl}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#282828',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                padding: '10px 22px',
                borderRadius: '24px',
                border: '1px solid #444',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onWatchVideo({
                  id: uploadedVideo.id,
                  title: uploadedVideo.title,
                  channel: uploadedVideo.channel?.title || 'WaveMusic Creator',
                  channelAvatar:
                    uploadedVideo.channel?.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                  subscribers: '10K subscribers',
                  views: '0 views',
                  time: 'Just now',
                  duration: '2:00',
                  thumbnail: uploadedVideo.thumbnailUrl || thumbnailUrl,
                  videoUrl: uploadedVideo.masterPlaylistUrl.startsWith('http')
                    ? uploadedVideo.masterPlaylistUrl
                    : `${apiBase}${uploadedVideo.masterPlaylistUrl}`,
                  category: category,
                  description: uploadedVideo.description || '',
                  likesCount: 0,
                  commentsCount: 0,
                  verified: true
                });
              }}
              style={{
                background: '#ff0000',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                padding: '10px 24px',
                borderRadius: '24px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Play size={16} fill="#fff" />
              Watch Video Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
