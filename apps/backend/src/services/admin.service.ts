import * as crypto from 'crypto';
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
    const currentDest = this.storageManager.getCurrentUploadDestination();

    for (const bkt of this.db.storageBuckets.values()) {
      // 1. Calculate live sum from file chunks
      const chunks = Array.from(this.db.fileChunks.values()).filter(
        (c) => c.bucketName === bkt.bucketName || c.bucketId === bkt.id
      );
      const chunkBytes = chunks.reduce((acc, c) => acc + (c.chunkSizeBytes || 0), 0);
      const chunkCount = chunks.length;

      let liveBytes = Math.max(bkt.usedStorageBytes || 0, chunkBytes);
      let liveCount = Math.max(bkt.objectCount || 0, chunkCount);

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

      bkt.logicalQuotaBytes = bkt.logicalQuotaBytes || DEFAULT_LOGICAL_QUOTA_BYTES;
      bkt.usedStorageBytes = liveBytes;
      bkt.objectCount = liveCount;
      const consumed = liveBytes + (bkt.reservedStorageBytes || 0);
      bkt.availableStorageBytes = Math.max(0, bkt.logicalQuotaBytes - consumed);

      if (consumed >= bkt.logicalQuotaBytes) {
        bkt.healthStatus = BucketHealthStatus.EXHAUSTED_100;
      } else if (consumed / bkt.logicalQuotaBytes >= 0.85) {
        bkt.healthStatus = BucketHealthStatus.HIGH_USAGE_85;
      } else if (consumed / bkt.logicalQuotaBytes >= 0.70) {
        bkt.healthStatus = BucketHealthStatus.WARNING_70;
      } else {
        bkt.healthStatus = BucketHealthStatus.HEALTHY;
      }

      await this.db.saveBucketToPostgres(bkt);
    }

    const currentTarget = this.storageManager.getCurrentUploadDestination();

    return Array.from(this.db.storageBuckets.values())
      .map((b) => {
        const quota = b.logicalQuotaBytes || DEFAULT_LOGICAL_QUOTA_BYTES;
        const used = b.usedStorageBytes || 0;
        const avail = Math.max(0, quota - (used + (b.reservedStorageBytes || 0)));
        const usagePercent = Math.min(100, Number(((used / quota) * 100).toFixed(1)));
        const isFull = (used + (b.reservedStorageBytes || 0)) >= quota;
        const isCurrentDestination = currentTarget ? currentTarget.id === b.id : false;

        return {
          ...b,
          logicalQuotaBytes: quota,
          availableStorageBytes: avail,
          usagePercent,
          isFull,
          isCurrentDestination
        };
      })
      .sort((a, b) => a.priority - b.priority);
  }

  public getBuckets(): IStorageBucket[] {
    const currentTarget = this.storageManager.getCurrentUploadDestination();
    return Array.from(this.db.storageBuckets.values())
      .map((b) => {
        const quota = b.logicalQuotaBytes || DEFAULT_LOGICAL_QUOTA_BYTES;
        const used = b.usedStorageBytes || 0;
        const avail = Math.max(0, quota - (used + (b.reservedStorageBytes || 0)));
        const usagePercent = Math.min(100, Number(((used / quota) * 100).toFixed(1)));
        const isFull = (used + (b.reservedStorageBytes || 0)) >= quota;
        const isCurrentDestination = currentTarget ? currentTarget.id === b.id : false;

        return {
          ...b,
          logicalQuotaBytes: quota,
          availableStorageBytes: avail,
          usagePercent,
          isFull,
          isCurrentDestination
        };
      })
      .sort((a, b) => a.priority - b.priority);
  }

  public addBucket(dto: CreateStorageBucketDto): IStorageBucket {
    const quota = DEFAULT_LOGICAL_QUOTA_BYTES; // Strictly 8 GiB quota per bucket
    const bucketName = (dto.bucketName || (dto as any).name || '').trim().toLowerCase();
    const storageAccountId = dto.storageAccountId || (dto as any).accountId || 'b0000000-0000-0000-0000-000000000001';

    // Check if bucket with this exact name already exists
    const existingByName = Array.from(this.db.storageBuckets.values()).find(
      (b) => b.bucketName.toLowerCase() === bucketName
    );

    if (existingByName) {
      existingByName.priority = dto.priority || existingByName.priority;
      existingByName.logicalQuotaBytes = quota;
      existingByName.storageAccountId = storageAccountId;
      existingByName.updatedAt = new Date();

      if (this.db.pgPool) {
        this.db.pgPool.query(
          `UPDATE storage_buckets SET logical_quota_bytes = $1, priority = $2, storage_account_id = $3, updated_at = NOW() WHERE id::text = $4 OR bucket_name = $5;`,
          [quota, existingByName.priority, storageAccountId, existingByName.id, bucketName]
        ).catch((err: any) => console.warn('[POSTGRES] update existing bucket notice:', err.message));
      }

      console.log(`[STORAGE] Bucket "${bucketName}" updated (8 GiB quota, priority: ${existingByName.priority}).`);
      return existingByName;
    }

    const id = (dto as any).id || crypto.randomUUID();

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
        `INSERT INTO storage_buckets (id, storage_account_id, bucket_name, region, logical_quota_bytes, used_storage_bytes, reserved_storage_bytes, priority, health_status, is_enabled, object_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, 'HEALTHY', true, 0, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET bucket_name = EXCLUDED.bucket_name, logical_quota_bytes = EXCLUDED.logical_quota_bytes, priority = EXCLUDED.priority, updated_at = NOW();`,
        [id, pgAccountId, bucketName, dto.region || 'auto', quota, newBucket.priority]
      ).catch((err: any) => console.warn('[POSTGRES] addBucket sync notice:', err.message));
    }

    console.log(`[STORAGE] New bucket "${bucketName}" registered (independent 8 GiB quota, priority: ${newBucket.priority}). Total buckets: ${this.db.storageBuckets.size}`);
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
    return Array.from(this.db.users.values()).map((u) => {
      const { passwordHash, ...clean } = u;
      return clean as IUser;
    });
  }

  public async createUser(data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
    role?: UserRole;
  }): Promise<IUser> {
    const email = data.email.trim().toLowerCase();
    const username = data.username.trim();
    for (const u of this.db.users.values()) {
      if (u.email.toLowerCase() === email) {
        throw new Error('Email is already registered.');
      }
      if (u.username.toLowerCase() === username.toLowerCase()) {
        throw new Error('Username is already taken.');
      }
    }

    const userId = crypto.randomUUID();
    const role = data.role || UserRole.CREATOR;
    const passwordHash = crypto.createHash('sha256').update(data.password + '_salt_agy').digest('hex');

    const newUser: IUser & { passwordHash: string } = {
      id: userId,
      email,
      username,
      displayName: data.displayName?.trim() || username,
      role,
      status: UserStatus.ACTIVE,
      passwordHash,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.db.users.set(newUser.id, newUser);

    if (this.db.pgPool) {
      try {
        await this.db.pgPool.query(
          `INSERT INTO users (id, email, username, password_hash, display_name, role, status, is_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (email) DO UPDATE SET
             username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             display_name = EXCLUDED.display_name,
             role = EXCLUDED.role,
             status = EXCLUDED.status,
             updated_at = NOW()`,
          [
            newUser.id,
            newUser.email,
            newUser.username,
            newUser.passwordHash,
            newUser.displayName,
            newUser.role,
            newUser.status,
            newUser.isVerified,
            newUser.createdAt,
            newUser.updatedAt
          ]
        );
      } catch (pgErr: any) {
        console.warn('[POSTGRES] user insert fallback:', pgErr.message);
      }
    }

    const { passwordHash: _, ...clean } = newUser;
    return clean as IUser;
  }

  public async updateUser(
    userId: string,
    data: {
      username?: string;
      email?: string;
      password?: string;
      displayName?: string;
      role?: UserRole;
      status?: UserStatus;
    }
  ): Promise<IUser> {
    const user = this.db.users.get(userId);
    if (!user) throw new Error('User not found.');

    if (data.username && data.username.trim()) {
      user.username = data.username.trim();
    }
    if (data.email && data.email.trim()) {
      user.email = data.email.trim().toLowerCase();
    }
    if (data.displayName && data.displayName.trim()) {
      user.displayName = data.displayName.trim();
    }
    if (data.role) {
      user.role = data.role;
    }
    if (data.status) {
      user.status = data.status;
    }
    if (data.password && data.password.trim().length >= 6) {
      user.passwordHash = crypto.createHash('sha256').update(data.password.trim() + '_salt_agy').digest('hex');
    }
    user.updatedAt = new Date();
    this.db.users.set(userId, user);

    if (this.db.pgPool) {
      try {
        await this.db.pgPool.query(
          `UPDATE users SET
             username = $1,
             email = $2,
             display_name = $3,
             role = $4,
             status = $5,
             password_hash = $6,
             updated_at = NOW()
           WHERE id = $7 OR username = $1 OR email = $2`,
          [
            user.username,
            user.email,
            user.displayName,
            user.role,
            user.status,
            user.passwordHash,
            userId
          ]
        );
      } catch (pgErr: any) {
        console.warn('[POSTGRES] user update fallback:', pgErr.message);
      }
    }

    const { passwordHash: _, ...clean } = user;
    return clean as IUser;
  }

  public async deleteUser(userId: string): Promise<boolean> {
    const user = this.db.users.get(userId);
    if (!user) throw new Error('User not found.');

    this.db.users.delete(userId);

    if (this.db.pgPool) {
      try {
        await this.db.pgPool.query(`DELETE FROM users WHERE id = $1 OR username = $2 OR email = $3`, [
          userId,
          user.username,
          user.email
        ]);
      } catch (pgErr: any) {
        console.warn('[POSTGRES] user delete fallback:', pgErr.message);
      }
    }

    return true;
  }

  public updateUserRole(userId: string, role: UserRole): IUser {
    const user = this.db.users.get(userId);
    if (!user) throw new Error('User not found.');
    user.role = role;
    user.updatedAt = new Date();
    if (this.db.pgPool) {
      this.db.pgPool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, userId]).catch(console.warn);
    }
    const { passwordHash: _, ...clean } = user;
    return clean as IUser;
  }

  public updateUserStatus(userId: string, status: UserStatus): IUser {
    const user = this.db.users.get(userId);
    if (!user) throw new Error('User not found.');
    user.status = status;
    user.updatedAt = new Date();
    if (this.db.pgPool) {
      this.db.pgPool.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, userId]).catch(console.warn);
    }
    const { passwordHash: _, ...clean } = user;
    return clean as IUser;
  }
}
