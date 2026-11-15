import {
  VideoProcessingStatus,
  IFileManifest
} from '@platform/common';
import { DatabaseService } from '../database/db.service';
import { StorageManagerService } from './storage-manager.service';

export interface TranscodingJobResult {
  jobId: string;
  fileId: string;
  status: VideoProcessingStatus;
  masterPlaylistUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  profiles: string[];
}

export class VideoTranscodingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storageManager: StorageManagerService
  ) {}

  /**
   * Generates master HLS playlist (.m3u8) string linking adaptive bitrate profiles.
   */
  public generateMasterPlaylist(mediaId: string, profiles: string[]): string {
    let manifest = '#EXTM3U\n#EXT-X-VERSION:6\n\n';

    if (profiles.includes('360p')) {
      manifest +=
        '#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360,CODECS="avc1.4d401f,mp4a.40.2"\n' +
        `hls/${mediaId}/360p/index.m3u8\n\n`;
    }
    if (profiles.includes('480p')) {
      manifest +=
        '#EXT-X-STREAM-INF:BANDWIDTH=1528000,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2"\n' +
        `hls/${mediaId}/480p/index.m3u8\n\n`;
    }
    if (profiles.includes('720p')) {
      manifest +=
        '#EXT-X-STREAM-INF:BANDWIDTH=2960000,RESOLUTION=1280x720,CODECS="avc1.640020,mp4a.40.2"\n' +
        `hls/${mediaId}/720p/index.m3u8\n\n`;
    }
    if (profiles.includes('1080p')) {
      manifest +=
        '#EXT-X-STREAM-INF:BANDWIDTH=5192000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"\n' +
        `hls/${mediaId}/1080p/index.m3u8\n\n`;
    }

    return manifest;
  }

  /**
   * Generates a variant playlist (.m3u8) for a specific resolution.
   */
  public generateVariantPlaylist(mediaId: string, resolution: string, durationSeconds: number): string {
    const segmentDuration = 4;
    const segmentCount = Math.max(1, Math.ceil(durationSeconds / segmentDuration));

    let playlist =
      '#EXTM3U\n' +
      '#EXT-X-VERSION:6\n' +
      `#EXT-X-TARGETDURATION:${segmentDuration}\n` +
      '#EXT-X-MEDIA-SEQUENCE:0\n\n';

    for (let i = 0; i < segmentCount; i++) {
      const isLast = i === segmentCount - 1;
      const segDuration = isLast ? (durationSeconds % segmentDuration || segmentDuration) : segmentDuration;
      playlist += `#EXTINF:${segDuration.toFixed(3)},\n`;
      playlist += `segment_${String(i).padStart(5, '0')}.ts\n`;
    }

    playlist += '#EXT-X-ENDLIST\n';
    return playlist;
  }

  /**
   * Processes a video file: generates HLS master playlist, variant playlists,
   * stores them in the first available storage bucket, and marks the video READY.
   */
  public async processVideo(fileId: string): Promise<TranscodingJobResult> {
    const file = this.db.files.get(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found.`);
    }

    const jobId = `job-${Date.now()}`;
    const profiles = ['360p', '720p', '1080p'];
    const estimatedDuration = 120; // 2 minutes default

    const eligibleBuckets = this.storageManager.getEligibleBuckets();
    const targetBucket = eligibleBuckets[0];
    const provider = this.storageManager.getProvider(targetBucket.storageAccountId);

    // Generate and store master playlist
    const masterPlaylistContent = this.generateMasterPlaylist(fileId, profiles);
    const masterKey = `media/${fileId}/master.m3u8`;
    await provider.putObject(
      targetBucket.bucketName,
      masterKey,
      masterPlaylistContent,
      'application/x-mpegURL'
    );

    // Generate and store variant playlists
    for (const res of profiles) {
      const variantContent = this.generateVariantPlaylist(fileId, res, estimatedDuration);
      const variantKey = `media/${fileId}/hls/${fileId}/${res}/index.m3u8`;
      await provider.putObject(
        targetBucket.bucketName,
        variantKey,
        variantContent,
        'application/x-mpegURL'
      );
    }

    // Generate placeholder thumbnail
    const thumbnailKey = `media/${fileId}/thumbnail.jpg`;
    const thumbnailContent = Buffer.from('MOCK_JPEG_THUMBNAIL_BYTES');
    await provider.putObject(
      targetBucket.bucketName,
      thumbnailKey,
      thumbnailContent,
      'image/jpeg'
    );

    const masterPlaylistUrl = `/api/streaming/manifest/${fileId}/master.m3u8`;
    const thumbnailUrl = `/api/streaming/thumbnail/${fileId}/thumbnail.jpg`;

    file.processingStatus = VideoProcessingStatus.COMPLETED;

    return {
      jobId,
      fileId,
      status: VideoProcessingStatus.COMPLETED,
      masterPlaylistUrl,
      thumbnailUrl,
      durationSeconds: estimatedDuration,
      profiles
    };
  }
}
