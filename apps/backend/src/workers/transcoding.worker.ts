import { DatabaseService } from '../database/db.service';
import { StorageManagerService } from '../services/storage-manager.service';
import { VideoTranscodingService } from '../services/video-transcoding.service';
import { VideoProcessingStatus, FileUploadStatus } from '@platform/common';

export class TranscodingWorkerRunner {
  private isRunning = false;
  private isShuttingDown = false;
  private pollIntervalMs = 5000;

  constructor(
    private readonly db: DatabaseService,
    private readonly storageManager: StorageManagerService,
    private readonly transcodingService: VideoTranscodingService
  ) {}

  public async start(): Promise<void> {
    this.isRunning = true;
    console.log('🎬 Transcoding Worker Runner started. Listening for background media jobs...');

    this.registerSignalHandlers();

    while (this.isRunning && !this.isShuttingDown) {
      try {
        await this.processNextJob();
      } catch (err) {
        console.error('Error in transcoding worker loop:', err);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    console.log('🛑 Transcoding Worker Runner stopped cleanly.');
  }

  public async processNextJob(): Promise<boolean> {
    // Look for pending files that are READY for transcoding but have QUEUED processing status
    const pendingFiles = Array.from(this.db.files.values()).filter(
      (f) => f.uploadStatus === FileUploadStatus.READY && f.processingStatus === VideoProcessingStatus.QUEUED
    );

    if (pendingFiles.length === 0) {
      return false;
    }

    const targetFile = pendingFiles[0];
    console.log(`[WORKER] Claiming media job for file: ${targetFile.id} (${targetFile.originalFilename})`);

    targetFile.processingStatus = VideoProcessingStatus.PROCESSING;

    try {
      const result = await this.transcodingService.processVideo(targetFile.id);
      targetFile.processingStatus = VideoProcessingStatus.COMPLETED;
      console.log(`[WORKER] Successfully generated adaptive HLS stream for ${targetFile.id}:`, {
        masterPlaylistUrl: result.masterPlaylistUrl,
        profiles: result.profiles
      });
      return true;
    } catch (err: any) {
      targetFile.processingStatus = VideoProcessingStatus.FAILED;
      console.error(`[WORKER] Transcoding failed for file ${targetFile.id}:`, err?.message || err);
      return false;
    }
  }

  public stop(): void {
    this.isShuttingDown = true;
    this.isRunning = false;
  }

  private registerSignalHandlers(): void {
    const handleShutdown = () => {
      console.log('\n[WORKER] Graceful shutdown signal received. Finishing in-flight jobs...');
      this.stop();
    };

    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
  }
}

if (require.main === module) {
  const db = new DatabaseService();
  const storageManager = new StorageManagerService(db);
  const transcodingService = new VideoTranscodingService(db, storageManager);
  const runner = new TranscodingWorkerRunner(db, storageManager, transcodingService);
  runner.start().catch(console.error);
}
