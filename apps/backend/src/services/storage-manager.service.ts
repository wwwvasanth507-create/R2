import {
  IStorageAccount,
  IStorageBucket,
  IStorageAlert,
  BucketHealthStatus,
  AlertSeverity,
  DEFAULT_LOGICAL_QUOTA_BYTES,
  DEFAULT_CHUNK_SIZE_BYTES,
  R2_FREE_STORAGE_BYTES,
  R2_STORAGE_COST_PER_GB,
  R2_CLASS_A_PER_MILLION,
  R2_CLASS_B_PER_MILLION,
  BYTES_PER_GIB
} from '@platform/common';
import {
  DynamicBucketAllocationEngine,
  ChunkDistributionPlanner,
  RangeDownloadGateway,
  IStorageProvider,
  R2StorageProvider,
  LocalStorageProvider,
  AlertNotificationEvent
} from '@platform/storage-engine';
import { DatabaseService } from '../database/db.service';
import { config } from '../config/configuration';

export class StorageManagerService {
  public readonly allocationEngine: DynamicBucketAllocationEngine;
  public readonly chunkPlanner: ChunkDistributionPlanner;
  public readonly rangeGateway: RangeDownloadGateway;
  private providers: Map<string, IStorageProvider> = new Map();

  constructor(private readonly db: DatabaseService) {
    this.allocationEngine = new DynamicBucketAllocationEngine(config.defaultLogicalQuotaBytes);
    this.chunkPlanner = new ChunkDistributionPlanner(
      this.allocationEngine,
      config.defaultChunkSizeBytes
    );

    // Initialize range download gateway with provider resolver
    this.rangeGateway = new RangeDownloadGateway((accountId) => this.getProvider(accountId));

    // Listen for storage alert threshold events (70%, 85%, 100% and recovery)
    this.allocationEngine.onAlert(async (event: AlertNotificationEvent) => {
      await this.recordStorageAlert(event);
    });
  }

  /**
   * Lazily resolves or instantiates an IStorageProvider for a given account.
   * If valid Cloudflare R2 credentials exist, uses R2StorageProvider.
   * Otherwise falls back to LocalStorageProvider.
   */
  public getProvider(accountId: string): IStorageProvider {
    if (this.providers.has(accountId)) {
      return this.providers.get(accountId)!;
    }

    const account = this.db.storageAccounts.get(accountId);
    if (!account) {
      // Fallback local provider
      const local = new LocalStorageProvider(undefined, accountId);
      this.providers.set(accountId, local);
      return local;
    }

    // Check if real R2 credentials exist (placeholder seed keys start with cf_key_ or mock_)
    if (
      account.accessKeyId &&
      account.secretAccessKey &&
      !account.accessKeyId.startsWith('mock_') &&
      !account.accessKeyId.startsWith('cf_key_')
    ) {
      try {
        const r2Provider = new R2StorageProvider({
          accountId: account.accountId,
          accessKeyId: account.accessKeyId,
          secretAccessKey: account.secretAccessKey,
          endpoint: account.endpoint
        });
        this.providers.set(accountId, r2Provider);
        return r2Provider;
      } catch (err) {
        console.warn(`Failed to initialize R2 provider for ${account.id}, falling back to local provider:`, err);
      }
    }

    const localProvider = new LocalStorageProvider(undefined, account.id);
    this.providers.set(accountId, localProvider);
    return localProvider;
  }

  /**
   * Records a storage threshold alert with deduplication and email logging.
   */
  public async recordStorageAlert(event: AlertNotificationEvent): Promise<IStorageAlert> {
    const alert: IStorageAlert = {
      id: `alt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      bucketId: event.bucketId,
      storageAccountId: event.accountId,
      severity: event.severity,
      thresholdPercent: event.thresholdPercent,
      message: event.message,
      usedBytes: event.usedBytes,
      quotaBytes: event.quotaBytes,
      isResolved: event.severity === AlertSeverity.RECOVERY,
      resolvedAt: event.severity === AlertSeverity.RECOVERY ? new Date() : undefined,
      emailSent: true,
      sentAt: new Date(),
      createdAt: new Date()
    };

    this.db.storageAlerts.set(alert.id, alert);
    console.log(`[STORAGE ALERT ${event.severity}] ${event.message}`);
    return alert;
  }

  /**
   * Get all active, enabled buckets ordered by allocation priority ASC.
   */
  public getEligibleBuckets(): IStorageBucket[] {
    return Array.from(this.db.storageBuckets.values())
      .filter((b) => b.isEnabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Computes system-wide storage consumption and cost projections.
   */
  public getStorageMetrics() {
    let totalUsedBytes = 0;
    let totalReservedBytes = 0;
    let totalQuotaBytes = 0;

    for (const bkt of this.db.storageBuckets.values()) {
      totalUsedBytes += bkt.usedStorageBytes;
      totalReservedBytes += bkt.reservedStorageBytes;
      totalQuotaBytes += bkt.logicalQuotaBytes;
    }

    const totalAllocated = totalUsedBytes + totalReservedBytes;
    const totalAvailable = Math.max(0, totalQuotaBytes - totalAllocated);

    // Free Tier calculation (10 GB free allowance per standard account)
    const totalGBStored = totalUsedBytes / BYTES_PER_GIB;
    const paidGB = Math.max(0, totalGBStored - (R2_FREE_STORAGE_BYTES / BYTES_PER_GIB));
    const estimatedMonthlyCostUsd = paidGB * R2_STORAGE_COST_PER_GB;
    const freeTierSavingsUsd = Math.min(totalGBStored, 10) * R2_STORAGE_COST_PER_GB;

    return {
      totalUsedBytes,
      totalReservedBytes,
      totalAllocatedBytes: totalAllocated,
      totalQuotaBytes,
      totalAvailableBytes: totalAvailable,
      totalGBStored: parseFloat(totalGBStored.toFixed(2)),
      estimatedMonthlyCostUsd: parseFloat(estimatedMonthlyCostUsd.toFixed(2)),
      freeTierSavingsUsd: parseFloat(freeTierSavingsUsd.toFixed(2)),
      accountsCount: this.db.storageAccounts.size,
      bucketsCount: this.db.storageBuckets.size,
      activeAlertsCount: Array.from(this.db.storageAlerts.values()).filter((a) => !a.isResolved).length
    };
  }
}
