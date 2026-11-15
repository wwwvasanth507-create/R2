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
  const [autoThumbnails, setAutoThumbnails] = useState<string[]>([]);
  const [selectedThumbIndex, setSelectedThumbIndex] = useState<number>(0);
  const [isCustomThumbnail, setIsCustomThumbnail] = useState<boolean>(false);
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

  // Extract 3 Candidate Frames across Video Timeline (YouTube Studio Style)
  const extractVideoThumbnails = async (selectedFile: File): Promise<{ duration: number; thumbnails: string[] }> => {
    return new Promise((resolve) => {
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').trim();

      const generateFallbackThumbs = (titleText: string): string[] => {
        const fallbacks: string[] = [];
        const themes = [
          { bg: ['#1e3a8a', '#3b82f6'], badge: 'FRAME 01' },
          { bg: ['#0f172a', '#334155'], badge: 'FRAME 02' },
          { bg: ['#831843', '#e11d48'], badge: 'FRAME 03' }
        ];
        themes.forEach((theme) => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const grad = ctx.createLinearGradient(0, 0, 640, 360);
              grad.addColorStop(0, theme.bg[0]);
              grad.addColorStop(1, theme.bg[1]);
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, 640, 360);

              // WaveMusic Branding
              ctx.fillStyle = '#ff0000';
              ctx.fillRect(40, 40, 16, 24);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 20px sans-serif';
              ctx.fillText('WaveMusic', 66, 58);

              // Title
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 26px sans-serif';
              const displayTitle = titleText.length > 28 ? titleText.slice(0, 28) + '...' : titleText;
              ctx.fillText(displayTitle, 40, 180);

              // Frame Badge
              ctx.fillStyle = 'rgba(0,0,0,0.6)';
              ctx.fillRect(40, 280, 100, 30);
              ctx.fillStyle = '#38bdf8';
              ctx.font = 'bold 12px sans-serif';
              ctx.fillText(theme.badge, 52, 300);

              fallbacks.push(canvas.toDataURL('image/jpeg', 0.85));
            }
          } catch {}
        });
        return fallbacks.length === 3 ? fallbacks : [
          'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
          'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800'
        ];
      };

      try {
        const videoElem = document.createElement('video');
        videoElem.preload = 'auto';
        const fileUrl = URL.createObjectURL(selectedFile);
        videoElem.src = fileUrl;
        videoElem.muted = true;
        videoElem.playsInline = true;

        const capturedThumbs: string[] = [];
        let duration = 0;
        let isDone = false;

        const finish = (resultThumbs: string[]) => {
          if (isDone) return;
          isDone = true;
          try {
            URL.revokeObjectURL(fileUrl);
          } catch {}
          resolve({ duration: duration || 120, thumbnails: resultThumbs });
        };

        const captureFrameAt = (timeSec: number): Promise<string | null> => {
          return new Promise((res) => {
            const onSeeked = () => {
              videoElem.removeEventListener('seeked', onSeeked);
              try {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 360;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
                  res(canvas.toDataURL('image/jpeg', 0.85));
                  return;
                }
              } catch {}
              res(null);
            };
            videoElem.addEventListener('seeked', onSeeked);
            videoElem.currentTime = Math.max(0.1, timeSec);
          });
        };

        videoElem.onloadedmetadata = async () => {
          duration = videoElem.duration || 0;
          const t1 = Math.max(0.5, duration * 0.15);
          const t2 = Math.max(1.0, duration * 0.50);
          const t3 = Math.max(1.5, duration * 0.85);

          try {
            const f1 = await captureFrameAt(t1);
            if (f1) capturedThumbs.push(f1);
            const f2 = await captureFrameAt(t2);
            if (f2) capturedThumbs.push(f2);
            const f3 = await captureFrameAt(t3);
            if (f3) capturedThumbs.push(f3);
          } catch {}

          if (capturedThumbs.length === 0) {
            finish(generateFallbackThumbs(cleanName));
          } else {
            while (capturedThumbs.length < 3) {
              capturedThumbs.push(capturedThumbs[0]);
            }
            finish(capturedThumbs);
          }
        };

        videoElem.onerror = () => {
          finish(generateFallbackThumbs(cleanName));
        };

        setTimeout(() => {
          if (!isDone) {
            finish(capturedThumbs.length > 0 ? capturedThumbs : generateFallbackThumbs(cleanName));
          }
        }, 3500);
      } catch {
        resolve({ duration: 120, thumbnails: generateFallbackThumbs(cleanName) });
      }
    });
  };

  // Handle Video File Selection
  const handleFileChosen = async (selectedFile: File) => {
    setFile(selectedFile);
    setFileSizeFormatted(formatBytes(selectedFile.size));

    // Auto-fill Title from filename
    const cleanName = selectedFile.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .trim();
    setTitle(cleanName || 'My Uploaded Video');

    // Auto-extract candidate frames
    const { duration, thumbnails } = await extractVideoThumbnails(selectedFile);
    setVideoDuration(duration);
    if (duration > 0 && duration < 60) {
      setIsShort(true);
    }
    setAutoThumbnails(thumbnails);
    if (thumbnails.length > 0) {
      setThumbnailUrl(thumbnails[0]);
      setSelectedThumbIndex(0);
      setIsCustomThumbnail(false);
      setIsAutoThumbnail(true);
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
          setIsCustomThumbnail(true);
          setIsAutoThumbnail(false);
          setSelectedThumbIndex(-1);
        }
      };
      reader.readAsDataURL(thumbFile);
    }
  };

  // 1. Direct Single-Shot Upload (for videos <= 250 MB)
  const handleDirectUpload = async (finalThumbnailUrl: string) => {
    if (!file) return;

    // Build Query Parameters for all metadata (safely avoiding any oversized HTTP headers)
    const queryParams = new URLSearchParams({
      title: title.trim(),
      description: description.trim(),
      category: category,
      tags: tags,
      isShort: String(isShort),
      visibility: visibility,
      filename: file.name,
      duration: String(Math.round(videoDuration || 120)),
      thumbnailUrl: finalThumbnailUrl
    });

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open('POST', `${apiBase}/api/videos/upload?${queryParams.toString()}`);

    // Set standard headers
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

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

        setTransferredText(`${formatBytes(e.loaded)} of ${formatBytes(e.total)} (Direct Upload)`);
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

    xhr.send(file);
  };

  // 2. Chunked Multi-Part Upload (for videos > 100 MB, split into 100 MB slices across Cloudflare R2 buckets)
  const handleChunkedUpload = async (finalThumbnailUrl: string) => {
    if (!file) return;

    // 95 MiB = 99,614,720 bytes (strictly under Cloudflare's 100 MB HTTP proxy limit)
    const CHUNK_SIZE = 95 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    setStep('uploading');
    setUploadPercent(0);
    setTransferredText(`Initializing 100 MB chunked session (0 of ${totalChunks} chunks)...`);

    // Step A: Initialize Chunked Session
    let initData: any;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const initRes = await fetch(`${apiBase}/api/videos/chunked/init`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          tags,
          isShort,
          visibility,
          filename: file.name,
          duration: Math.round(videoDuration || 120),
          thumbnailUrl: finalThumbnailUrl,
          totalSizeBytes: file.size,
          chunkSizeBytes: CHUNK_SIZE,
          chunkCount: totalChunks
        })
      });

      if (!initRes.ok) {
        const errJson = await initRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Initialization failed with status ${initRes.status}`);
      }

      initData = await initRes.json();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize chunked upload.');
      setStep('details');
      return;
    }

    const { fileId, videoId } = initData;

    // Step B: Upload Each 250 MB Chunk Separately
    let totalBytesUploaded = 0;
    let lastTime = Date.now();
    let lastLoaded = 0;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);
      const currentChunkSize = end - start;

      let chunkDone = false;
      let retryCount = 0;

      while (!chunkDone && retryCount < 3) {
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhrRef.current = xhr;

            xhr.open(
              'POST',
              `${apiBase}/api/videos/chunked/upload-chunk?fileId=${encodeURIComponent(fileId)}&chunkIndex=${i}`
            );

            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            try {
              const token = localStorage.getItem('token');
              if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            } catch {}

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const currentOverallBytes = totalBytesUploaded + e.loaded;
                const percent = Math.min(99, Math.round((currentOverallBytes / file.size) * 100));
                setUploadPercent(percent);

                const now = Date.now();
                const diffSec = (now - lastTime) / 1000;
                if (diffSec >= 0.5) {
                  const bytesDiff = currentOverallBytes - lastLoaded;
                  const speedBps = bytesDiff / diffSec;
                  const speedMbps = (speedBps / (1024 * 1024)).toFixed(1);
                  setUploadSpeed(`${speedMbps} MB/s`);

                  const remainingBytes = file.size - currentOverallBytes;
                  const remainingSecs = speedBps > 0 ? Math.round(remainingBytes / speedBps) : 0;
                  setRemainingText(
                    remainingSecs > 0
                      ? `${remainingSecs}s remaining • Chunk ${i + 1}/${totalChunks}`
                      : `Finalizing chunk ${i + 1}/${totalChunks}...`
                  );

                  lastLoaded = currentOverallBytes;
                  lastTime = now;
                }

                setTransferredText(
                  `${formatBytes(currentOverallBytes)} of ${formatBytes(file.size)} (Chunk ${i + 1} of ${totalChunks})`
                );
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                totalBytesUploaded += currentChunkSize;
                chunkDone = true;
                resolve();
              } else {
                reject(new Error(`Chunk ${i + 1} failed with status code ${xhr.status}`));
              }
            };

            xhr.onerror = () => {
              reject(new Error(`Network error uploading Chunk ${i + 1}`));
            };

            xhr.send(chunkBlob);
          });
        } catch (err: any) {
          retryCount++;
          console.warn(`Retry ${retryCount} for Chunk ${i + 1}:`, err.message);
          if (retryCount >= 3) {
            setErrorMessage(`Upload failed at Chunk ${i + 1} of ${totalChunks}: ${err.message}`);
            setStep('details');
            return;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    // Step C: Finalize & Complete Upload
    setUploadPercent(100);
    setRemainingText('Stitching chunks into unified streamable video...');
    setTransferredText(`${formatBytes(file.size)} of ${formatBytes(file.size)} (All ${totalChunks} chunks uploaded)`);

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const compRes = await fetch(`${apiBase}/api/videos/chunked/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileId, videoId })
      });

      if (!compRes.ok) {
        const errJson = await compRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Finalization failed with status ${compRes.status}`);
      }

      const compData = await compRes.json();
      setUploadedVideo(compData.video);
      onUploadSuccess(compData.video);
      setStep('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete chunked video.');
      setStep('details');
    }
  };

  // Main Upload Entry Point (Auto-routes between Direct and 250 MB Chunked Upload)
  const handleStartUpload = async () => {
    if (!file) return;
    if (!title.trim()) {
      setErrorMessage('Please enter a title for your video.');
      return;
    }

    setErrorMessage('');
    setStep('uploading');
    setUploadPercent(0);

    // 1. If thumbnail is a base64 string, upload it to get a clean short URL
    let finalThumbnailUrl = '';
    if (thumbnailUrl && thumbnailUrl.startsWith('data:image/')) {
      try {
        const thumbRes = await fetch(`${apiBase}/api/videos/upload-thumbnail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: thumbnailUrl })
        });
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          finalThumbnailUrl = thumbData.thumbnailUrl;
        }
      } catch (err) {
        console.warn('Thumbnail upload notice:', err);
      }
    } else if (thumbnailUrl && !thumbnailUrl.startsWith('data:image/')) {
      finalThumbnailUrl = thumbnailUrl;
    }

    if (!finalThumbnailUrl) {
      finalThumbnailUrl = 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800';
    }

    // 2. Check 100 MB Threshold (Cloudflare Tunnel & Proxy Safe Limit)
    const CHUNK_SIZE_THRESHOLD = 95 * 1024 * 1024; // 95 MB (~99.6 MB decimal, safely under Cloudflare's 100 MB ceiling)

    if (file.size <= CHUNK_SIZE_THRESHOLD) {
      // <= 100 MB: Upload straightly
      await handleDirectUpload(finalThumbnailUrl);
    } else {
      // > 100 MB: Split into 100 MB chunks and upload separately across Cloudflare R2 buckets
      await handleChunkedUpload(finalThumbnailUrl);
    }
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <FileVideo size={20} color="#3ea6ff" />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>{file?.name}</span>
              <span style={{ fontSize: '12px', color: '#888' }}>({fileSizeFormatted})</span>
              {file && file.size > 95 * 1024 * 1024 ? (
                <span
                  style={{
                    fontSize: '11px',
                    background: 'rgba(62, 166, 255, 0.15)',
                    color: '#3ea6ff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(62, 166, 255, 0.3)',
                    fontWeight: 600
                  }}
                >
                  ⚡ Auto-Split: {Math.ceil(file.size / (95 * 1024 * 1024))} x 100 MB chunks (Multi-Bucket R2)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    background: 'rgba(74, 222, 128, 0.15)',
                    color: '#4ade80',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    fontWeight: 600
                  }}
                >
                  ✓ Direct Stream Upload (&le; 100 MB)
                </span>
              )}
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

          {/* YouTube Studio Style Thumbnail Section */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#aaa' }}>
                Thumbnail
              </label>
              <span style={{ fontSize: '11px', color: '#888' }}>
                Select an auto-generated frame or upload a custom image
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {/* Custom Thumbnail Upload Card */}
              <div
                onClick={() => thumbInputRef.current?.click()}
                style={{
                  height: '86px',
                  borderRadius: '8px',
                  background: isCustomThumbnail ? '#1e293b' : '#181818',
                  border: isCustomThumbnail ? '2px solid #3ea6ff' : '1px dashed #444',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease'
                }}
              >
                {isCustomThumbnail && thumbnailUrl ? (
                  <>
                    <img
                      src={thumbnailUrl}
                      alt="Custom Thumbnail"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: '#3ea6ff',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      ✓
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon size={22} color="#888" />
                    <span style={{ fontSize: '11px', color: '#aaa', marginTop: '6px', fontWeight: 500 }}>
                      + Upload
                    </span>
                  </>
                )}
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleCustomThumbnailChosen}
                />
              </div>

              {/* 3 Auto-generated Frame Thumbnails */}
              {autoThumbnails.map((thumb, idx) => {
                const isSelected = !isCustomThumbnail && selectedThumbIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedThumbIndex(idx);
                      setIsCustomThumbnail(false);
                      setIsAutoThumbnail(true);
                      setThumbnailUrl(thumb);
                    }}
                    style={{
                      height: '86px',
                      borderRadius: '8px',
                      background: '#181818',
                      border: isSelected ? '2px solid #3ea6ff' : '1px solid #333',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 10px rgba(62, 166, 255, 0.4)' : 'none'
                    }}
                  >
                    <img
                      src={thumb}
                      alt={`Auto Frame ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: '#3ea6ff',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        ✓
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        left: '4px',
                        background: 'rgba(0,0,0,0.7)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        color: isSelected ? '#3ea6ff' : '#aaa',
                        fontWeight: 600
                      }}
                    >
                      {idx === 0 ? 'Frame 1' : idx === 1 ? 'Frame 2' : 'Frame 3'}
                    </div>
                  </div>
                );
              })}
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
                src={
                  uploadedVideo.thumbnailUrl?.startsWith('http')
                    ? uploadedVideo.thumbnailUrl
                    : (uploadedVideo.thumbnailUrl ? `${apiBase}${uploadedVideo.thumbnailUrl}` : thumbnailUrl)
                }
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
                  thumbnail: uploadedVideo.thumbnailUrl?.startsWith('http')
                    ? uploadedVideo.thumbnailUrl
                    : (uploadedVideo.thumbnailUrl ? `${apiBase}${uploadedVideo.thumbnailUrl}` : thumbnailUrl),
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
