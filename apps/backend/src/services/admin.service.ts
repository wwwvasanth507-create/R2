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
    return bucket;
  }

  public deleteBucket(bucketId: string): { success: boolean; id: string } {
    const bucket = this.db.storageBuckets.get(bucketId);
    if (!bucket) throw new Error('Bucket not found.');
    this.db.storageBuckets.delete(bucketId);
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
