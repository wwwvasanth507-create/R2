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
  ) { }

  public async getDashboardOverviewAsync() {
    await this.getBucketsAsync();
    return this.getDashboardOverview();
  }

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
    const id = (dto.accountId && dto.accountId.length === 36 && dto.accountId.includes('-'))
      ? dto.accountId
      : 'b0000000-0000-0000-0000-' + String(Date.now()).slice(-12).padStart(12, '0');

    const newAccount: IStorageAccount & { secretAccessKey: string } = {
      id,
      displayName: dto.displayName,
      accountId: dto.accountId,
      endpoint: dto.endpoint,
      accessKeyId: dto.accessKeyId,
      secretAccessKey: dto.secretAccessKey,
      secretAccessKeyMasked: dto.secretAccessKey ? dto.secretAccessKey.substring(0, 6) + '...' + dto.secretAccessKey.slice(-4) : 'cf_sec...prod',
      status: StorageAccountStatus.ACTIVE,
      monthlyBudgetUsd: dto.monthlyBudgetUsd || 50.0,
      currentEstimatedCostUsd: 0.0,
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store in memory first!
    this.db.storageAccounts.set(id, newAccount);
    // Initialize provider
    this.storageManager.getProvider(id);

    // Persist to PostgreSQL storage_accounts table
    if (this.db.pgPool) {
      try {
        await this.db.pgPool.query(
          `INSERT INTO storage_accounts (id, display_name, account_id, endpoint, access_key_id, secret_access_key_encrypted, status, monthly_budget_usd, current_cost_usd, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, 0.0, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             endpoint = EXCLUDED.endpoint,
             access_key_id = EXCLUDED.access_key_id,
             secret_access_key_encrypted = EXCLUDED.secret_access_key_encrypted;`,
          [id, dto.displayName, dto.accountId, dto.endpoint, dto.accessKeyId, dto.secretAccessKey || 'cf_secret_prod', dto.monthlyBudgetUsd || 50.0]
        );
        console.log(`[POSTGRES] Storage account "${dto.displayName}" (${id}) persisted to PostgreSQL.`);
      } catch (err: any) {
        console.warn('[POSTGRES] Account persistence notice:', err.message);
      }
    }

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

  public async deleteStorageAccount(accountId: string): Promise<{ success: boolean; id: string }> {
    let targetAccKey: string | undefined;
    let account: IStorageAccount | undefined;

    if (this.db.storageAccounts.has(accountId)) {
      targetAccKey = accountId;
      account = this.db.storageAccounts.get(accountId);
    } else {
      for (const [k, a] of this.db.storageAccounts.entries()) {
        if (a.id === accountId || a.accountId === accountId || a.displayName.toLowerCase() === accountId.toLowerCase()) {
          targetAccKey = k;
          account = a;
          break;
        }
      }
    }

    if (targetAccKey) {
      this.db.storageAccounts.delete(targetAccKey);
    }

    // Remove any associated buckets for this account
    for (const [bId, b] of Array.from(this.db.storageBuckets.entries())) {
      if (b.storageAccountId === accountId || (account && b.storageAccountId === account.id)) {
        this.db.storageBuckets.delete(bId);
      }
    }

    if (this.db.pgPool) {
      try {
        const targetId = account ? account.id : accountId;
        await this.db.pgPool.query(
          `DELETE FROM storage_buckets WHERE storage_account_id::text = $1 OR storage_account_id IN (SELECT id FROM storage_accounts WHERE id::text = $1 OR account_id = $1);`,
          [targetId]
        );
        await this.db.pgPool.query(
          `DELETE FROM storage_accounts WHERE id::text = $1 OR account_id = $1;`,
          [targetId]
        );
      } catch (err: any) {
        console.warn('[POSTGRES] deleteStorageAccount notice:', err.message);
      }
    }

    console.log(`[STORAGE] Storage account "${accountId}" and associated bucket deleted.`);
    return { success: true, id: accountId };
  }

  // --- Bucket Management ---
  public async getBucketsAsync(): Promise<IStorageBucket[]> {
    for (const bkt of this.db.storageBuckets.values()) {
      // 1. Calculate live sum from file chunks
      const chunks = Array.from(this.db.fileChunks.values()).filter(
        (c) => c.bucketName === bkt.bucketName || c.bucketId === bkt.id
      );
      const chunkBytes = chunks.reduce((acc, c) => acc + (c.chunkSizeBytes || 0), 0);
      const chunkCount = chunks.length;

      let liveBytes = chunkBytes;
      let liveCount = chunkCount;

      // 2. Query Cloudflare R2 provider directly for live cloud numbers
      try {
        const provider = this.storageManager.getProvider(bkt.storageAccountId);
        if (provider && typeof (provider as any).getBucketUsage === 'function') {
          const r2Usage = await (provider as any).getBucketUsage(bkt.bucketName);
          if (r2Usage.totalSizeBytes > 0 || r2Usage.objectCount > 0) {
            liveBytes = r2Usage.totalSizeBytes;
            liveCount = r2Usage.objectCount;
          }
        }
      } catch (err: any) {
        console.warn(`[STORAGE LIVE QUERY] Notice for bucket ${bkt.bucketName}:`, err.message);
      }

      if (liveBytes > 0 || liveCount > 0) {
        bkt.usedStorageBytes = liveBytes;
        bkt.objectCount = liveCount;
        bkt.availableStorageBytes = Math.max(0, bkt.logicalQuotaBytes - liveBytes);
        await this.db.saveBucketToPostgres(bkt);
      }
    }

    return Array.from(this.db.storageBuckets.values()).sort((a, b) => a.priority - b.priority);
  }

  public getBuckets(): IStorageBucket[] {
    return Array.from(this.db.storageBuckets.values()).sort((a, b) => a.priority - b.priority);
  }

  public addBucket(dto: CreateStorageBucketDto): IStorageBucket {
    const quota = dto.logicalQuotaBytes || (dto as any).quotaBytes || DEFAULT_LOGICAL_QUOTA_BYTES;
    const bucketName = (dto.bucketName || (dto as any).name || '').trim().toLowerCase();
    const storageAccountId = dto.storageAccountId || (dto as any).accountId || 'b0000000-0000-0000-0000-000000000001';

    // Check if account already has a bucket assigned
    const existingForAccount = Array.from(this.db.storageBuckets.values()).find(
      (b) => b.storageAccountId === storageAccountId
    );

    if (existingForAccount) {
      // Strictly maintain 1 R2 bucket per account: update / replace the bucket name and priority!
      existingForAccount.bucketName = bucketName;
      existingForAccount.logicalQuotaBytes = quota;
      existingForAccount.priority = dto.priority || existingForAccount.priority;
      existingForAccount.updatedAt = new Date();

      if (this.db.pgPool) {
        this.db.pgPool.query(
          `UPDATE storage_buckets SET bucket_name = $1, logical_quota_bytes = $2, priority = $3, updated_at = NOW() WHERE id::text = $4 OR storage_account_id::text = $5;`,
          [bucketName, quota, existingForAccount.priority, existingForAccount.id, storageAccountId]
        ).catch((err: any) => console.warn('[POSTGRES] update existing bucket notice:', err.message));
      }

      console.log(`[STORAGE] Account "${storageAccountId}" bucket updated to "${bucketName}" (8 GiB quota).`);
      return existingForAccount;
    }

    const id = (dto as any).id || (storageAccountId && typeof storageAccountId === 'string' && storageAccountId.startsWith('b0000000-')
      ? 'c' + storageAccountId.slice(1)
      : 'c0000000-0000-0000-0000-' + String(Date.now()).slice(-12).padStart(12, '0'));

    const newBucket: IStorageBucket = {
      id,
      bucketName,
      storageAccountId,
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
      const pgAccountId = storageAccountId && typeof storageAccountId === 'string' && storageAccountId.includes('-') && storageAccountId.length === 36
        ? storageAccountId
        : 'b0000000-0000-0000-0000-000000000001';
      this.db.pgPool.query(
        `INSERT INTO storage_buckets (id, storage_account_id, bucket_name, region, logical_quota_bytes, used_storage_bytes, reserved_storage_bytes, priority, health_status, is_enabled, object_count)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, 'HEALTHY', true, 0)
         ON CONFLICT (id) DO UPDATE SET bucket_name = EXCLUDED.bucket_name, logical_quota_bytes = EXCLUDED.logical_quota_bytes, priority = EXCLUDED.priority, updated_at = NOW();`,
        [id, pgAccountId, bucketName, dto.region || 'auto', quota, newBucket.priority]
      ).catch((err: any) => console.warn('[POSTGRES] addBucket sync notice:', err.message));
    }

    console.log(`[STORAGE] New bucket "${bucketName}" registered for account "${storageAccountId}" (8 GiB quota).`);
    return newBucket;
  }

  public async addBucketAsync(dto: CreateStorageBucketDto): Promise<IStorageBucket> {
    const bucket = this.addBucket(dto);
    if (this.db.pgPool) {
      const quota = bucket.logicalQuotaBytes;
      const bucketName = bucket.bucketName;
      const storageAccountId = bucket.storageAccountId;
      const pgAccountId = storageAccountId && typeof storageAccountId === 'string' && storageAccountId.includes('-') && storageAccountId.length === 36
        ? storageAccountId
        : 'b0000000-0000-0000-0000-000000000001';

      try {
        await this.db.pgPool.query(
          `INSERT INTO storage_buckets (id, storage_account_id, bucket_name, region, logical_quota_bytes, used_storage_bytes, reserved_storage_bytes, priority, health_status, is_enabled, object_count, updated_at)
           VALUES ($1, $2, $3, $4, $5, 0, 0, $6, 'HEALTHY', true, 0, NOW())
           ON CONFLICT (id) DO UPDATE SET bucket_name = EXCLUDED.bucket_name, logical_quota_bytes = EXCLUDED.logical_quota_bytes, priority = EXCLUDED.priority, updated_at = NOW();`,
          [bucket.id, pgAccountId, bucketName, bucket.region || 'auto', quota, bucket.priority]
        );
      } catch (err: any) {
        console.warn('[POSTGRES] addBucketAsync sync notice:', err.message);
      }
    }
    return bucket;
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
        `UPDATE storage_buckets SET logical_quota_bytes = $1, is_enabled = $2, priority = $3, updated_at = NOW() WHERE id::text = $4 OR bucket_name = $5;`,
        [bucket.logicalQuotaBytes, bucket.isEnabled, bucket.priority, bucketId, bucket.bucketName]
      ).catch((err: any) => console.warn('[POSTGRES] updateBucket sync notice:', err.message));
    }

    return bucket;
  }

  public async deleteBucket(bucketId: string): Promise<{ success: boolean; id: string }> {
    if (!bucketId) return { success: false, id: '' };
    const bIdLower = String(bucketId).toLowerCase();
    let targetKey: string | undefined;
    let bucket: IStorageBucket | undefined;

    if (this.db.storageBuckets.has(bucketId)) {
      targetKey = bucketId;
      bucket = this.db.storageBuckets.get(bucketId);
    } else {
      for (const [k, b] of this.db.storageBuckets.entries()) {
        if (
          b.id === bucketId ||
          (b.bucketName && b.bucketName.toLowerCase() === bIdLower)
        ) {
          targetKey = k;
          bucket = b;
          break;
        }
      }
    }

    if (targetKey) {
      this.db.storageBuckets.delete(targetKey);
    }

    if (this.db.pgPool) {
      try {
        await this.db.pgPool.query(
          `DELETE FROM storage_buckets WHERE id::text = $1 OR bucket_name ILIKE $2;`,
          [bucket ? bucket.id : bucketId, bucket ? bucket.bucketName : bucketId]
        );
      } catch (err: any) {
        console.warn('[POSTGRES] deleteBucket sync notice:', err.message);
      }
    }

    console.log(`[STORAGE] Bucket "${bucket ? bucket.bucketName : bucketId}" deleted from server and database.`);
    return { success: true, id: bucket ? bucket.id : bucketId };
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
