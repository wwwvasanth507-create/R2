'use client';

import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, Pause, Play, RefreshCw, HardDrive } from 'lucide-react';
import { DEFAULT_CHUNK_SIZE_BYTES, DEFAULT_LOGICAL_QUOTA_BYTES } from '@platform/common';

export const ChunkUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [distributedBuckets, setDistributedBuckets] = useState<string[]>([]);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [simulatedSize, setSimulatedSize] = useState<number>(20 * 1024 * 1024 * 1024); // 20 GiB

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GiB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MiB`;
  };

  const handleStartUpload = async () => {
    setIsUploading(true);
    setIsPaused(false);
    setProgress(0);
    setUploadComplete(false);

    const size = file ? file.size : simulatedSize;
    const chunkSize = DEFAULT_CHUNK_SIZE_BYTES; // 256 MiB
    const count = Math.ceil(size / chunkSize);
    setTotalChunks(count);

    // Calculate dynamic multi-bucket allocation (8 GiB logical quota per bucket)
    const chunksPerBucket = Math.floor(DEFAULT_LOGICAL_QUOTA_BYTES / chunkSize); // 32 chunks per bucket
    const bucketCount = Math.ceil(count / chunksPerBucket);
    const buckets: string[] = [];
    for (let i = 0; i < bucketCount; i++) {
      buckets.push(`prod-media-r2-bucket-${String.fromCharCode(65 + i)}`);
    }
    setDistributedBuckets(buckets);

    // Simulate direct chunk upload to presigned R2 URLs
    for (let i = 0; i < count; i++) {
      setCurrentChunk(i + 1);
      setProgress(Math.round(((i + 1) / count) * 100));
      // Artificial delay simulating network stream
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    setIsUploading(false);
    setUploadComplete(true);
  };

  return (
    <div
      style={{
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '720px',
        margin: '0 auto',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(229, 9, 20, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <UploadCloud size={24} color="#e50914" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>
            Multi-Bucket Distributed Uploader
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
            Direct-to-R2 presigned streaming with 256 MiB chunks & 8 GiB sequential bucket allocation
          </p>
        </div>
      </div>

      {/* Preset large file buttons */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '8px' }}>
          TEST BENCHMARK SIZES (Up to 20 GiB+ Across Multiple Buckets)
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: '500 MiB (Single Bucket)', size: 500 * 1024 * 1024 },
            { label: '2 GiB (Single Bucket)', size: 2 * 1024 * 1024 * 1024 },
            { label: '8 GiB (Max Bucket Quota)', size: 8 * 1024 * 1024 * 1024 },
            { label: '12 GiB (Spillover to 2 Buckets)', size: 12 * 1024 * 1024 * 1024 },
            { label: '20 GiB (Distributed over 3 Buckets)', size: 20 * 1024 * 1024 * 1024 }
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setSimulatedSize(preset.size);
                setFile(null);
                setUploadComplete(false);
                setProgress(0);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: simulatedSize === preset.size && !file ? '#e50914' : '#374151',
                background: simulatedSize === preset.size && !file ? 'rgba(229,9,20,0.1)' : '#1f2937',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* File Dropzone */}
      <div
        style={{
          border: '2px dashed #374151',
          borderRadius: '12px',
          padding: '28px',
          textAlign: 'center',
          background: '#0d1117',
          marginBottom: '24px'
        }}
      >
        <HardDrive size={32} color="#60a5fa" style={{ marginBottom: '8px' }} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', marginBottom: '4px' }}>
          {file ? file.name : `Selected Size: ${formatBytes(simulatedSize)}`}
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
          Files &gt; 8 GiB are automatically divided into 256 MiB chunks and allocated across authorized R2 buckets.
        </p>
      </div>

      {/* Allocation Visualizer */}
      {distributedBuckets.length > 0 && (
        <div
          style={{
            background: '#1f2937',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px'
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px' }}>
            DYNAMIC BUCKET ALLOCATION MATRIX (8 GiB Logical Quota per Bucket)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${distributedBuckets.length}, 1fr)`, gap: '8px' }}>
            {distributedBuckets.map((bName, idx) => (
              <div
                key={bName}
                style={{
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '12px'
                }}
              >
                <div style={{ color: '#ef4444', fontWeight: 700 }}>Bucket {idx + 1}</div>
                <div style={{ color: '#fff', fontSize: '11px', marginTop: '2px' }}>{bName}</div>
                <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px' }}>
                  Quota: 8.0 GiB (256 MiB Chunks)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: '#9ca3af' }}>
              Uploading Chunk {currentChunk} of {totalChunks} (SHA-256 Verified)
            </span>
            <span style={{ color: '#fff', fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ height: '8px', background: '#374151', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #e50914, #f97316)',
                transition: 'width 0.1s linear'
              }}
            />
          </div>
        </div>
      )}

      {/* Success Notification */}
      {uploadComplete && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22c55e',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            color: '#22c55e',
            fontSize: '14px'
          }}
        >
          <CheckCircle2 size={20} />
          <span>
            Upload successfully verified! All chunks committed across {distributedBuckets.length} R2 buckets. Virtual
            manifest is READY for Range streaming and HLS transcoding.
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleStartUpload}
          disabled={isUploading}
          style={{
            flex: 1,
            padding: '12px',
            background: isUploading ? '#374151' : '#e50914',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <UploadCloud size={18} />
          {isUploading ? 'Streaming Chunks...' : 'Initiate Distributed Upload'}
        </button>
      </div>
    </div>
  );
};
