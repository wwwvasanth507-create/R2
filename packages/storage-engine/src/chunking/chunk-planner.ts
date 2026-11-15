import {
  DEFAULT_CHUNK_SIZE_BYTES,
  IStorageBucket,
  IFileChunkManifest,
  ChunkUploadStatus
} from '@platform/common';
import { DynamicBucketAllocationEngine, AllocationResult } from '../allocation/allocation-engine';
import { IStorageProvider } from '../interfaces/storage-provider.interface';

export interface PlannedChunk {
  manifest: IFileChunkManifest;
  presignedUploadUrl: string;
  reservationId: string;
}

export interface FileDistributionPlan {
  fileId: string;
  totalSizeBytes: number;
  chunkSizeBytes: number;
  chunkCount: number;
  isDistributed: boolean;
  chunks: PlannedChunk[];
}

export class ChunkDistributionPlanner {
  constructor(
    private readonly allocationEngine: DynamicBucketAllocationEngine,
    private readonly defaultChunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES
  ) {}

  /**
   * Plans the chunk layout and sequentially allocates capacity across authorized buckets.
   * Files larger than an individual bucket's remaining capacity (or the 8 GiB quota)
   * seamlessly spill over into subsequent buckets.
   */
  public async planDistribution(
    fileId: string,
    totalSizeBytes: number,
    eligibleBuckets: IStorageBucket[],
    getProviderForAccount: (accountId: string) => IStorageProvider,
    customChunkSizeBytes?: number
  ): Promise<FileDistributionPlan> {
    const chunkSizeBytes = customChunkSizeBytes || this.defaultChunkSizeBytes;
    const chunkCount = Math.ceil(totalSizeBytes / chunkSizeBytes);
    const plannedChunks: PlannedChunk[] = [];
    const usedBuckets = new Set<string>();

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const byteStart = chunkIndex * chunkSizeBytes;
      const byteEnd = Math.min(totalSizeBytes - 1, byteStart + chunkSizeBytes - 1);
      const currentChunkSize = byteEnd - byteStart + 1;

      // Sequential allocation using dynamic bucket quota engine
      const { bucket, reservation } = await this.allocationEngine.allocateChunkCapacity(
        eligibleBuckets,
        fileId,
        chunkIndex,
        currentChunkSize
      );

      usedBuckets.add(bucket.id);
      const provider = getProviderForAccount(bucket.storageAccountId);
      const objectKey = `files/${fileId}/chunks/chunk_${String(chunkIndex).padStart(6, '0')}.bin`;

      // 1 hour presigned upload URL directly to R2 bucket
      const presignedUploadUrl = await provider.generatePresignedUploadUrl(
        bucket.bucketName,
        objectKey,
        3600,
        'application/octet-stream'
      );

      const chunkManifest: IFileChunkManifest = {
        id: `chk-${fileId}-${chunkIndex}`,
        fileId,
        chunkIndex,
        storageAccountId: bucket.storageAccountId,
        bucketId: bucket.id,
        bucketName: bucket.bucketName,
        objectKey,
        byteStart,
        byteEnd,
        chunkSizeBytes: currentChunkSize,
        status: ChunkUploadStatus.PENDING
      };

      plannedChunks.push({
        manifest: chunkManifest,
        presignedUploadUrl,
        reservationId: reservation.id
      });
    }

    return {
      fileId,
      totalSizeBytes,
      chunkSizeBytes,
      chunkCount,
      isDistributed: usedBuckets.size > 1,
      chunks: plannedChunks
    };
  }
}
