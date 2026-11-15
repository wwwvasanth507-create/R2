import { StorageAccountStatus, BucketHealthStatus, VideoProcessingStatus } from './storage.types';
import { UserRole } from './auth.types';

export interface CreateUploadSessionDto {
  originalFilename: string;
  mimeType: string;
  totalSizeBytes: number;
  totalSha256Checksum?: string;
}

export interface ChunkUploadPlanItem {
  chunkIndex: number;
  byteStart: number;
  byteEnd: number;
  chunkSizeBytes: number;
  bucketId: string;
  bucketName: string;
  storageAccountId: string;
  objectKey: string;
  presignedUploadUrl: string;
}

export interface UploadSessionResponseDto {
  fileId: string;
  chunkCount: number;
  chunkSizeBytes: number;
  totalSizeBytes: number;
  isDistributed: boolean;
  chunks: ChunkUploadPlanItem[];
}

export interface CompleteChunkUploadDto {
  fileId: string;
  chunkIndex: number;
  chunkSha256Checksum: string;
  actualSizeBytes: number;
}

export interface CreateStorageAccountDto {
  displayName: string;
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  monthlyBudgetUsd?: number;
}

export interface CreateStorageBucketDto {
  bucketName: string;
  storageAccountId: string;
  region?: string;
  logicalQuotaBytes?: number; // Defaults to 8 GiB
  priority?: number;
}

export interface UpdateBucketQuotaDto {
  logicalQuotaBytes: number;
  isEnabled?: boolean;
  priority?: number;
}

export interface StorageHealthReportDto {
  accountsCount: number;
  bucketsCount: number;
  totalAllocatedBytes: number;
  totalReservedBytes: number;
  totalAvailableBytes: number;
  activeAlertsCount: number;
  estimatedCostUsd: number;
  buckets: {
    id: string;
    bucketName: string;
    accountId: string;
    usedBytes: number;
    reservedBytes: number;
    quotaBytes: number;
    usagePercent: number;
    status: BucketHealthStatus;
  }[];
}
