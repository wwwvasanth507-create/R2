import {
  DEFAULT_LOGICAL_QUOTA_BYTES,
  ALERT_THRESHOLD_70,
  ALERT_THRESHOLD_85,
  ALERT_THRESHOLD_100
} from '@platform/common';
import {
  IStorageBucket,
  IStorageReservation,
  IStorageAlert,
  BucketHealthStatus,
  AlertSeverity
} from '@platform/common';

export interface AllocationResult {
  bucket: IStorageBucket;
  reservation: IStorageReservation;
}

export interface AlertNotificationEvent {
  bucketId: string;
  bucketName: string;
  accountId: string;
  severity: AlertSeverity;
  thresholdPercent: number;
  usedBytes: number;
  quotaBytes: number;
  message: string;
}

export class DynamicBucketAllocationEngine {
  private alertListeners: ((event: AlertNotificationEvent) => Promise<void>)[] = [];
  // Bucket ID -> Last triggered severity for suppression/deduplication
  private alertStates: Map<string, AlertSeverity> = new Map();

  constructor(private readonly defaultQuotaBytes = DEFAULT_LOGICAL_QUOTA_BYTES) {}

  public onAlert(listener: (event: AlertNotificationEvent) => Promise<void>) {
    this.alertListeners.push(listener);
  }

  /**
   * Calculates effective remaining capacity accounting for both actual used storage
   * and pending uncommitted reservations.
   */
  public calculateRemainingCapacity(bucket: IStorageBucket): number {
    const quota = bucket.logicalQuotaBytes || this.defaultQuotaBytes;
    const used = bucket.usedStorageBytes || 0;
    const reserved = bucket.reservedStorageBytes || 0;
    const consumed = used + reserved;
    return Math.max(0, quota - consumed);
  }

  /**
   * Evaluates bucket usage ratio and triggers deduplicated threshold notifications.
   */
  public async evaluateBucketThresholds(bucket: IStorageBucket): Promise<BucketHealthStatus> {
    const quota = bucket.logicalQuotaBytes || this.defaultQuotaBytes;
    const used = bucket.usedStorageBytes || 0;
    const reserved = bucket.reservedStorageBytes || 0;
    const totalCommittedAndReserved = used + reserved;
    const ratio = quota > 0 ? totalCommittedAndReserved / quota : 1.0;

    const previousSeverity = this.alertStates.get(bucket.id);
    let currentSeverity: AlertSeverity | null = null;
    let newHealthStatus = BucketHealthStatus.HEALTHY;

    if (ratio >= ALERT_THRESHOLD_100) {
      newHealthStatus = BucketHealthStatus.EXHAUSTED_100;
      currentSeverity = AlertSeverity.EXHAUSTION_100;
    } else if (ratio >= ALERT_THRESHOLD_85) {
      newHealthStatus = BucketHealthStatus.HIGH_USAGE_85;
      currentSeverity = AlertSeverity.CRITICAL_85;
    } else if (ratio >= ALERT_THRESHOLD_70) {
      newHealthStatus = BucketHealthStatus.WARNING_70;
      currentSeverity = AlertSeverity.WARNING_70;
    } else {
      newHealthStatus = BucketHealthStatus.HEALTHY;
      if (previousSeverity && previousSeverity !== AlertSeverity.INFO) {
        // Recovery notice
        await this.dispatchAlert({
          bucketId: bucket.id,
          bucketName: bucket.bucketName,
          accountId: bucket.storageAccountId,
          severity: AlertSeverity.RECOVERY,
          thresholdPercent: Math.round(ratio * 100),
          usedBytes: totalCommittedAndReserved,
          quotaBytes: quota,
          message: `Bucket ${bucket.bucketName} capacity has recovered below 70% threshold (${Math.round(ratio * 100)}% used).`
        });
        this.alertStates.delete(bucket.id);
      }
      return newHealthStatus;
    }

    bucket.healthStatus = newHealthStatus;
    bucket.availableStorageBytes = Math.max(0, quota - totalCommittedAndReserved);

    // Suppress duplicate alerts if severity level hasn't escalated or changed
    if (currentSeverity && currentSeverity !== previousSeverity) {
      this.alertStates.set(bucket.id, currentSeverity);
      const percent = Math.round(ratio * 100);
      let msg = '';
      if (currentSeverity === AlertSeverity.EXHAUSTION_100) {
        msg = `CRITICAL: Bucket ${bucket.bucketName} has reached 100% logical quota (${percent}%). New allocations are halted.`;
      } else if (currentSeverity === AlertSeverity.CRITICAL_85) {
        msg = `HIGH USAGE WARNING: Bucket ${bucket.bucketName} has reached ${percent}% of logical quota. Immediate capacity review recommended.`;
      } else if (currentSeverity === AlertSeverity.WARNING_70) {
        msg = `NOTICE: Bucket ${bucket.bucketName} has crossed 70% storage threshold (${percent}% used).`;
      }

      await this.dispatchAlert({
        bucketId: bucket.id,
        bucketName: bucket.bucketName,
        accountId: bucket.storageAccountId,
        severity: currentSeverity,
        thresholdPercent: percent,
        usedBytes: totalCommittedAndReserved,
        quotaBytes: quota,
        message: msg
      });
    }

    return newHealthStatus;
  }

  private async dispatchAlert(event: AlertNotificationEvent): Promise<void> {
    for (const listener of this.alertListeners) {
      try {
        await listener(event);
      } catch (err) {
        console.error('Failed to dispatch alert notification event:', err);
      }
    }
  }

  /**
   * Intelligently selects the highest-priority bucket that has sufficient available space
   * for a file or chunk of `requiredBytes`.
   * Automatically skips any bucket that is full (100% / 8 GB reached) or cannot fit the required bytes.
   */
  public selectEligibleBucket(
    eligibleBuckets: IStorageBucket[],
    requiredBytes: number,
    excludeBucketIds: string[] = []
  ): IStorageBucket {
    const excludeSet = new Set(excludeBucketIds);
    const sorted = [...eligibleBuckets]
      .filter((b) => b.isEnabled && !excludeSet.has(b.id))
      .sort((a, b) => (a.priority || 1) - (b.priority || 1));

    for (const bucket of sorted) {
      const remaining = this.calculateRemainingCapacity(bucket);
      if (remaining >= requiredBytes) {
        return bucket;
      }
    }

    throw new Error(
      `Storage quota exceeded across all connected buckets. Upload size: ${(requiredBytes / (1024 * 1024)).toFixed(1)} MB exceeds available capacity across all ${eligibleBuckets.length} connected R2 buckets (8 GiB per-bucket limit). Please connect an additional R2 bucket.`
    );
  }

  /**
   * Sequentially allocates capacity for a chunk of size `chunkSizeBytes`.
   * Finds the first eligible bucket ordered by priority ASC, id ASC that has enough
   * remaining logical capacity.
   */
  public async allocateChunkCapacity(
    eligibleBuckets: IStorageBucket[],
    fileId: string,
    chunkIndex: number,
    chunkSizeBytes: number,
    reservationTtlMinutes = 60
  ): Promise<AllocationResult> {
    // Sort buckets sequentially by priority ascending (1 = highest), then by creation/id
    const sorted = [...eligibleBuckets]
      .filter((b) => b.isEnabled && b.healthStatus !== BucketHealthStatus.EXHAUSTED_100)
      .sort((a, b) => (a.priority || 1) - (b.priority || 1));

    for (const bucket of sorted) {
      const remaining = this.calculateRemainingCapacity(bucket);
      if (remaining >= chunkSizeBytes) {
        // Reserve capacity transactionally
        bucket.reservedStorageBytes += chunkSizeBytes;
        await this.evaluateBucketThresholds(bucket);

        const reservation: IStorageReservation = {
          id: `res-${fileId}-${chunkIndex}-${Date.now()}`,
          bucketId: bucket.id,
          fileId,
          chunkIndex,
          reservedBytes: chunkSizeBytes,
          expiresAt: new Date(Date.now() + reservationTtlMinutes * 60 * 1000),
          isCommitted: false,
          createdAt: new Date()
        };

        return {
          bucket,
          reservation
        };
      }
    }

    throw new Error(
      `Insufficient storage capacity across all ${eligibleBuckets.length} authorized buckets. Allocation halted.`
    );
  }

  /**
   * Commits a reservation upon verified chunk upload.
   * Decrements reserved capacity and increments actual used storage.
   */
  public commitReservation(bucket: IStorageBucket, reservation: IStorageReservation): void {
    bucket.reservedStorageBytes = Math.max(0, bucket.reservedStorageBytes - reservation.reservedBytes);
    bucket.usedStorageBytes += reservation.reservedBytes;
    bucket.objectCount = (bucket.objectCount || 0) + 1;
    reservation.isCommitted = true;
  }

  /**
   * Releases an uncommitted reservation on upload failure or expiration.
   */
  public releaseReservation(bucket: IStorageBucket, reservation: IStorageReservation): void {
    if (!reservation.isCommitted) {
      bucket.reservedStorageBytes = Math.max(0, bucket.reservedStorageBytes - reservation.reservedBytes);
    }
  }
}
