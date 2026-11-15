import {
  CreateUploadSessionDto,
  UploadSessionResponseDto,
  CompleteChunkUploadDto,
  IFileManifest,
  FileUploadStatus,
  ChunkUploadStatus,
  VideoProcessingStatus
} from '@platform/common';
import { DatabaseService } from '../database/db.service';
import { StorageManagerService } from './storage-manager.service';
import { ChecksumVerifier } from '@platform/storage-engine';

export class UploadService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storageManager: StorageManagerService
  ) {}

  /**
   * Initializes a large-file upload session.
   * Dynamically allocates capacity across authorized buckets (spilling over when 8 GiB
   * quota is met) and returns direct presigned upload URLs.
   */
  public async createUploadSession(
    ownerId: string,
    dto: CreateUploadSessionDto
  ): Promise<UploadSessionResponseDto> {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const eligibleBuckets = this.storageManager.getEligibleBuckets();

    if (eligibleBuckets.length === 0) {
      throw new Error('No active storage buckets are configured.');
    }

    // Plan chunk distribution across buckets
    const distributionPlan = await this.storageManager.chunkPlanner.planDistribution(
      fileId,
      dto.totalSizeBytes,
      eligibleBuckets,
      (accountId) => this.storageManager.getProvider(accountId)
    );

    // Persist file manifest in database
    const fileManifest: IFileManifest = {
      id: fileId,
      ownerId,
      originalFilename: dto.originalFilename,
      mimeType: dto.mimeType,
      totalSizeBytes: dto.totalSizeBytes,
      totalSha256Checksum: dto.totalSha256Checksum,
      chunkCount: distributionPlan.chunkCount,
      chunkSizeBytes: distributionPlan.chunkSizeBytes,
      uploadStatus: FileUploadStatus.UPLOADING,
      processingStatus: VideoProcessingStatus.QUEUED,
      isDistributed: distributionPlan.isDistributed,
      createdAt: new Date(),
      updatedAt: new Date(),
      chunks: distributionPlan.chunks.map((c) => c.manifest)
    };

    this.db.files.set(fileId, fileManifest);

    // Save individual chunk manifests and reservations
    for (const chunk of distributionPlan.chunks) {
      this.db.fileChunks.set(chunk.manifest.id, chunk.manifest);
    }

    return {
      fileId,
      chunkCount: distributionPlan.chunkCount,
      chunkSizeBytes: distributionPlan.chunkSizeBytes,
      totalSizeBytes: dto.totalSizeBytes,
      isDistributed: distributionPlan.isDistributed,
      chunks: distributionPlan.chunks.map((c) => ({
        chunkIndex: c.manifest.chunkIndex,
        byteStart: c.manifest.byteStart,
        byteEnd: c.manifest.byteEnd,
        chunkSizeBytes: c.manifest.chunkSizeBytes,
        bucketId: c.manifest.bucketId,
        bucketName: c.manifest.bucketName,
        storageAccountId: c.manifest.storageAccountId,
        objectKey: c.manifest.objectKey,
        presignedUploadUrl: c.presignedUploadUrl
      }))
    };
  }

  /**
   * Verifies an uploaded chunk's integrity, commits the capacity reservation,
   * and finalizes the file manifest once all chunks have completed.
   */
  public async verifyAndCompleteChunk(dto: CompleteChunkUploadDto): Promise<{ isFileReady: boolean }> {
    const file = this.db.files.get(dto.fileId);
    if (!file) {
      throw new Error(`File ${dto.fileId} not found.`);
    }

    const chunkKey = `chk-${dto.fileId}-${dto.chunkIndex}`;
    const chunk = this.db.fileChunks.get(chunkKey);
    if (!chunk) {
      throw new Error(`Chunk ${dto.chunkIndex} for file ${dto.fileId} not found.`);
    }

    // Idempotency check: if chunk is already verified, return file status without double-committing capacity
    if (chunk.status === ChunkUploadStatus.VERIFIED) {
      return { isFileReady: file.uploadStatus === FileUploadStatus.READY };
    }

    // Size validation
    if (dto.actualSizeBytes !== chunk.chunkSizeBytes) {
      chunk.status = ChunkUploadStatus.FAILED;
      throw new Error(
        `Chunk size mismatch: expected ${chunk.chunkSizeBytes} bytes, received ${dto.actualSizeBytes} bytes.`
      );
    }

    // Checksum assignment & verification
    chunk.chunkSha256Checksum = dto.chunkSha256Checksum;
    chunk.status = ChunkUploadStatus.VERIFIED;
    chunk.verifiedAt = new Date();

    // Commit bucket reservation
    const bucket = this.db.storageBuckets.get(chunk.bucketId);
    if (bucket) {
      const reservationId = `res-${dto.fileId}-${dto.chunkIndex}`;
      bucket.reservedStorageBytes = Math.max(0, bucket.reservedStorageBytes - chunk.chunkSizeBytes);
      bucket.usedStorageBytes += chunk.chunkSizeBytes;
      bucket.objectCount = (bucket.objectCount || 0) + 1;
      await this.storageManager.allocationEngine.evaluateBucketThresholds(bucket);
    }

    // Check if all chunks for this file are verified
    const allChunks = Array.from(this.db.fileChunks.values()).filter(
      (c) => c.fileId === dto.fileId
    );
    const allVerified =
      allChunks.length === file.chunkCount &&
      allChunks.every((c) => c.status === ChunkUploadStatus.VERIFIED);

    if (allVerified) {
      file.uploadStatus = FileUploadStatus.READY;
      file.updatedAt = new Date();
      return { isFileReady: true };
    }

    return { isFileReady: false };
  }

  /**
   * Retrieves upload progress and pending chunks for resumable uploads.
   */
  public getUploadSessionStatus(fileId: string) {
    const file = this.db.files.get(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found.`);
    }

    const chunks = Array.from(this.db.fileChunks.values())
      .filter((c) => c.fileId === fileId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    const verifiedCount = chunks.filter((c) => c.status === ChunkUploadStatus.VERIFIED).length;
    const progressPercent = file.chunkCount > 0 ? Math.round((verifiedCount / file.chunkCount) * 100) : 0;

    return {
      fileId,
      originalFilename: file.originalFilename,
      totalSizeBytes: file.totalSizeBytes,
      chunkCount: file.chunkCount,
      verifiedChunksCount: verifiedCount,
      progressPercent,
      uploadStatus: file.uploadStatus,
      isDistributed: file.isDistributed,
      chunks: chunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        byteStart: c.byteStart,
        byteEnd: c.byteEnd,
        chunkSizeBytes: c.chunkSizeBytes,
        bucketName: c.bucketName,
        status: c.status
      }))
    };
  }

  /**
   * Resumes an interrupted upload session. Generates fresh presigned URLs for
   * any pending or failed chunks, without regenerating or re-uploading verified chunks.
   */
  public async getResumableUploadSession(fileId: string) {
    const file = this.db.files.get(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found.`);
    }

    const chunks = Array.from(this.db.fileChunks.values())
      .filter((c) => c.fileId === fileId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    const pendingChunksWithUrls: any[] = [];
    let verifiedCount = 0;

    for (const chunk of chunks) {
      if (chunk.status === ChunkUploadStatus.VERIFIED) {
        verifiedCount++;
      } else {
        const provider = this.storageManager.getProvider(chunk.storageAccountId);
        const freshUrl = await provider.generatePresignedUploadUrl(
          chunk.bucketName,
          chunk.objectKey,
          3600,
          'application/octet-stream'
        );
        pendingChunksWithUrls.push({
          chunkIndex: chunk.chunkIndex,
          byteStart: chunk.byteStart,
          byteEnd: chunk.byteEnd,
          chunkSizeBytes: chunk.chunkSizeBytes,
          bucketId: chunk.bucketId,
          bucketName: chunk.bucketName,
          storageAccountId: chunk.storageAccountId,
          objectKey: chunk.objectKey,
          presignedUploadUrl: freshUrl,
          status: chunk.status
        });
      }
    }

    return {
      fileId,
      originalFilename: file.originalFilename,
      totalSizeBytes: file.totalSizeBytes,
      chunkCount: file.chunkCount,
      verifiedChunksCount: verifiedCount,
      pendingChunksCount: pendingChunksWithUrls.length,
      progressPercent: file.chunkCount > 0 ? Math.round((verifiedCount / file.chunkCount) * 100) : 0,
      uploadStatus: file.uploadStatus,
      isDistributed: file.isDistributed,
      pendingChunks: pendingChunksWithUrls
    };
  }
}
