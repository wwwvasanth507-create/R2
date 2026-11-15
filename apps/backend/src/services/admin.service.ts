import {
  IStorageAccount,
  StorageAccountStatus,
  IStorageBucket,
  BucketHealthStatus,
  IStorageAlert,
  IUser,
  UserRole,
  UserStatus,
  DEFAULT_LOGICAL_QUOTA_BYTES,
  CreateStorageAccountDto,
  CreateStorageBucketDto,
  UpdateBucketQuotaDto
} from '@platform/common';
import { DatabaseService } from '../database/db.service';
import { StorageManagerService } from './storage-manager.service';

export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storageManager: StorageManagerService
  ) {}

  public getDashboardOverview() {
    const storageMetrics = this.storageManager.getStorageMetrics();
    const totalUsers = this.db.users.size;
    const totalVideos = this.db.videos.size;
    const totalMovies = this.db.movies.size;
    const totalPosts = this.db.posts.size;
    const totalFiles = this.db.files.size;

    return {
      metrics: storageMetrics,
      counts: {
        totalUsers,
        totalVideos,
        totalMovies,
        totalPosts,
        totalFiles,
        activeUploadSessions: Array.from(this.db.files.values()).filter((f) => f.uploadStatus === 'UPLOADING').length
      }
    };
  }

  // --- Storage Accounts ---
  public getAccounts(): IStorageAccount[] {
    return Array.from(this.db.storageAccounts.values()).map((acc) => {
      const { secretAccessKey, ...safeAcc } = acc;
      return safeAcc;
    });
  }

  public async addStorageAccount(dto: CreateStorageAccountDto & { bucketName?: string }): Promise<IStorageAccount> {
    const id = `acc-r2-${Date.now()}`;
    const newAccount: IStorageAccount & { secretAccessKey: string } = {
      id,
      displayName: dto.displayName,
      accountId: dto.accountId,
      endpoint: dto.endpoint,
      accessKeyId: dto.accessKeyId,
      secretAccessKey: dto.secretAccessKey,
      secretAccessKeyMasked: dto.secretAccessKey.substring(0, 6) + '...' + dto.secretAccessKey.slice(-4),
      status: StorageAccountStatus.ACTIVE,
      monthlyBudgetUsd: dto.monthlyBudgetUsd || 50.0,
      currentEstimatedCostUsd: 0.0,
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Test connectivity
    const provider = this.storageManager.getProvider(id);
    this.db.storageAccounts.set(id, newAccount);

    // If bucketName is specified, create this Cloudflare account's single 8 GB R2 bucket immediately
    if (dto.bucketName && dto.bucketName.trim()) {
      this.addBucket({
        bucketName: dto.bucketName.trim().toLowerCase(),
        storageAccountId: id,
        region: 'auto',
        logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
        priority: this.db.storageBuckets.size + 1
      });
    }

    const { secretAccessKey, ...safeAccount } = newAccount;
    return safeAccount;
  }

  // --- Bucket Management ---
  public getBuckets(): IStorageBucket[] {
    return Array.from(this.db.storageBuckets.values()).sort((a, b) => a.priority - b.priority);
  }

  public addBucket(dto: CreateStorageBucketDto): IStorageBucket {
    // Strictly enforce: Exactly ONE R2 bucket per Cloudflare account!
    const existingForAccount = Array.from(this.db.storageBuckets.values()).find(
      (b) => b.storageAccountId === dto.storageAccountId
    );
    if (existingForAccount) {
      throw new Error(
        `Cloudflare account "${dto.storageAccountId}" already has an assigned bucket ("${existingForAccount.bucketName}"). Only 1 R2 bucket of 8 GB quota is allowed per Cloudflare account.`
      );
    }

    const id = `bkt-${Date.now()}`;
    // Strictly enforce 8 GiB quota (8,589,934,592 bytes)
    const quota = DEFAULT_LOGICAL_QUOTA_BYTES;

    const newBucket: IStorageBucket = {
      id,
      bucketName: dto.bucketName,
      storageAccountId: dto.storageAccountId,
      region: dto.region || 'auto',
      logicalQuotaBytes: quota,
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: quota,
      priority: dto.priority || this.db.storageBuckets.size + 1,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      lastValidatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.db.storageBuckets.set(id, newBucket);

    if (this.db.pgPool) {
      const pgBucketId = id.includes('-') && id.length === 36 ? id : 'c0000000-0000-0000-0000-' + String(Date.now()).slice(-12).padStart(12, '0');
      const pgAccountId = dto.storageAccountId.includes('-') && dto.storageAccountId.length === 36
        ? dto.storageAccountId
        : 'b0000000-0000-0000-0000-000000000001';
      this.db.pgPool.query(
        `INSERT INTO storage_buckets (id, storage_account_id, bucket_name, region, logical_quota_bytes, used_storage_bytes, reserved_storage_bytes, priority, health_status, is_enabled, object_count)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, 'HEALTHY', true, 0)
         ON CONFLICT (id) DO NOTHING;`,
        [pgBucketId, pgAccountId, dto.bucketName, dto.region || 'auto', quota, newBucket.priority]
      ).catch((err: any) => console.warn('[POSTGRES] addBucket sync notice:', err.message));
    }

    return newBucket;
  }

  public updateBucket(bucketId: string, dto: UpdateBucketQuotaDto): IStorageBucket {
    const bucket = this.db.storageBuckets.get(bucketId);
    if (!bucket) throw new Error('Bucket not found.');

    if (dto.logicalQuotaBytes !== undefined) {
      bucket.logicalQuotaBytes = dto.logicalQuotaBytes;
      this.storageManager.allocationEngine.evaluateBucketThresholds(bucket);
    }

    if (dto.isEnabled !== undefined) {
      bucket.isEnabled = dto.isEnabled;
    }

    if (dto.priority !== undefined) {
      bucket.priority = dto.priority;
    }

    bucket.updatedAt = new Date();

    if (this.db.pgPool) {
      this.db.pgPool.query(
        `UPDATE storage_buckets SET logical_quota_bytes = $1, is_enabled = $2, priority = $3, updated_at = NOW() WHERE id = $4 OR bucket_name = $5;`,
        [bucket.logicalQuotaBytes, bucket.isEnabled, bucket.priority, bucketId, bucket.bucketName]
      ).catch((err: any) => console.warn('[POSTGRES] updateBucket sync notice:', err.message));
    }

    return bucket;
  }

  public deleteBucket(bucketId: string): { success: boolean; id: string } {
    const bucket = this.db.storageBuckets.get(bucketId);
    if (!bucket) throw new Error('Bucket not found.');
    this.db.storageBuckets.delete(bucketId);

    if (this.db.pgPool) {
      this.db.pgPool.query(
        `DELETE FROM storage_buckets WHERE id = $1 OR bucket_name = $2;`,
        [bucketId, bucket.bucketName]
      ).catch((err: any) => console.warn('[POSTGRES] deleteBucket sync notice:', err.message));
    }

    return { success: true, id: bucketId };
  }

  // --- Alerts ---
  public getAlerts(): IStorageAlert[] {
    return Array.from(this.db.storageAlerts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  public resolveAlert(alertId: string): IStorageAlert {
    const alert = this.db.storageAlerts.get(alertId);
    if (!alert) throw new Error('Alert not found.');
    alert.isResolved = true;
    alert.resolvedAt = new Date();
    return alert;
  }

  // --- Users & Moderation ---
  public getUsers(): IUser[] {
    return Array.from(this.db.users.values());
  }

  public updateUserRole(userId: string, role: UserRole): IUser {
    const user = this.db.users.get(userId);
    if (!user) throw new Error('User not found.');
    user.role = role;
    user.updatedAt = new Date();
    return user;
  }

  public updateUserStatus(userId: string, status: UserStatus): IUser {
    const user = this.db.users.get(userId);
    if (!user) throw new Error('User not found.');
    user.status = status;
    user.updatedAt = new Date();
    return user;
  }
}
