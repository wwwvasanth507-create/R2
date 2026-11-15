export enum StorageAccountStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  DEGRADED = 'DEGRADED',
  ERROR = 'ERROR'
}

export enum BucketHealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING_70 = 'WARNING_70',
  HIGH_USAGE_85 = 'HIGH_USAGE_85',
  EXHAUSTED_100 = 'EXHAUSTED_100',
  DISABLED = 'DISABLED',
  ERROR = 'ERROR'
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING_70 = 'WARNING_70',
  CRITICAL_85 = 'CRITICAL_85',
  EXHAUSTION_100 = 'EXHAUSTION_100',
  RECOVERY = 'RECOVERY'
}

export enum FileUploadStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  VERIFYING = 'VERIFYING',
  READY = 'READY',
  FAILED = 'FAILED',
  ABORTED = 'ABORTED'
}

export enum ChunkUploadStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED'
}

export enum VideoProcessingStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface IStorageAccount {
  id: string;
  displayName: string;
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKeyMasked?: string;
  status: StorageAccountStatus;
  monthlyBudgetUsd: number;
  currentEstimatedCostUsd: number;
  lastHealthCheck?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStorageBucket {
  id: string;
  bucketName: string;
  storageAccountId: string;
  region: string;
  logicalQuotaBytes: number; // Defaults to 8 GiB
  usedStorageBytes: number;
  reservedStorageBytes: number;
  availableStorageBytes: number;
  priority: number; // 1 = highest priority for sequential allocation
  healthStatus: BucketHealthStatus;
  isEnabled: boolean;
  objectCount: number;
  lastValidatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStorageReservation {
  id: string;
  bucketId: string;
  fileId: string;
  chunkIndex: number;
  reservedBytes: number;
  expiresAt: Date;
  isCommitted: boolean;
  createdAt: Date;
}

export interface IFileManifest {
  id: string;
  ownerId: string;
  originalFilename: string;
  mimeType: string;
  totalSizeBytes: number;
  totalSha256Checksum?: string;
  chunkCount: number;
  chunkSizeBytes: number;
  uploadStatus: FileUploadStatus;
  processingStatus: VideoProcessingStatus;
  isDistributed: boolean;
  createdAt: Date;
  updatedAt: Date;
  chunks?: IFileChunkManifest[];
}

export interface IFileChunkManifest {
  id: string;
  fileId: string;
  chunkIndex: number; // 0, 1, 2, ... preserving byte order
  storageAccountId: string;
  bucketId: string;
  bucketName: string;
  objectKey: string;
  byteStart: number;
  byteEnd: number;
  chunkSizeBytes: number;
  chunkSha256Checksum?: string;
  status: ChunkUploadStatus;
  uploadedAt?: Date;
  verifiedAt?: Date;
}

export interface IStorageAlert {
  id: string;
  bucketId?: string;
  storageAccountId?: string;
  severity: AlertSeverity;
  thresholdPercent: number;
  message: string;
  usedBytes: number;
  quotaBytes: number;
  isResolved: boolean;
  resolvedAt?: Date;
  emailSent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

export interface IBillingMetrics {
  totalStorageBytes: number;
  totalBandwidthBytes: number;
  totalClassAOperations: number;
  totalClassBOperations: number;
  estimatedCostUsd: number;
  freeTierSavingsUsd: number;
  isBudgetExceeded: boolean;
}
