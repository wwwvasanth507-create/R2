import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Readable } from 'stream';
import {
  DEFAULT_LOGICAL_QUOTA_BYTES,
  DEFAULT_CHUNK_SIZE_BYTES,
  BucketHealthStatus,
  AlertSeverity,
  IStorageBucket,
  IFileManifest,
  ChunkUploadStatus,
  FileUploadStatus,
  VideoProcessingStatus
} from '@platform/common';
import {
  DynamicBucketAllocationEngine,
  AlertNotificationEvent
} from '../allocation/allocation-engine';
import { ChunkDistributionPlanner } from '../chunking/chunk-planner';
import { RangeDownloadGateway } from '../gateway/range-gateway';
import { LocalStorageProvider } from '../providers/local-storage.provider';
import { ChecksumVerifier } from '../crypto/checksum';

describe('Storage Engine - Multi-Account R2 & Dynamic Quotas', () => {
  it('enforces 8 GB logical quota and alerts at 70%, 85%, 100%', async () => {
    const engine = new DynamicBucketAllocationEngine(DEFAULT_LOGICAL_QUOTA_BYTES);
    const alerts: AlertNotificationEvent[] = [];
    engine.onAlert(async (ev) => {
      alerts.push(ev);
    });

    const bucketA: IStorageBucket = {
      id: 'b-1',
      bucketName: 'media-bucket-alpha',
      storageAccountId: 'acc-1',
      region: 'auto',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
      priority: 1,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const bucketB: IStorageBucket = {
      id: 'b-2',
      bucketName: 'media-bucket-beta',
      storageAccountId: 'acc-2',
      region: 'auto',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
      priority: 2,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 1. Allocate 6 GiB to Bucket A (75% of 8 GiB) -> should trigger 70% alert
    const sixGiB = 6 * 1024 * 1024 * 1024;
    const alloc1 = await engine.allocateChunkCapacity([bucketA, bucketB], 'f1', 0, sixGiB);
    assert.strictEqual(alloc1.bucket.id, 'b-1');
    assert.strictEqual(bucketA.healthStatus, BucketHealthStatus.WARNING_70);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].severity, AlertSeverity.WARNING_70);

    // 2. Allocate another 1 GiB (total 7 GiB = 87.5% of 8 GiB) -> should escalate to 85% alert
    const oneGiB = 1 * 1024 * 1024 * 1024;
    const alloc2 = await engine.allocateChunkCapacity([bucketA, bucketB], 'f1', 1, oneGiB);
    assert.strictEqual(alloc2.bucket.id, 'b-1');
    assert.strictEqual(bucketA.healthStatus, BucketHealthStatus.HIGH_USAGE_85);
    assert.strictEqual(alerts.length, 2);
    assert.strictEqual(alerts[1].severity, AlertSeverity.CRITICAL_85);

    // 3. Allocate 1 GiB more to Bucket A (total 8 GiB = 100%) -> should reach 100% stop
    const alloc3 = await engine.allocateChunkCapacity([bucketA, bucketB], 'f1', 2, oneGiB);
    assert.strictEqual(alloc3.bucket.id, 'b-1');
    assert.strictEqual(bucketA.healthStatus, BucketHealthStatus.EXHAUSTED_100);
    assert.strictEqual(alerts.length, 3);
    assert.strictEqual(alerts[2].severity, AlertSeverity.EXHAUSTION_100);

    // 4. Try allocating another 500 MiB: Bucket A is at 100% (8 GiB exhausted),
    // sequential allocation MUST automatically spill over to Bucket B (priority 2)
    const fiveHundredMiB = 500 * 1024 * 1024;
    const alloc4 = await engine.allocateChunkCapacity([bucketA, bucketB], 'f2', 0, fiveHundredMiB);
    assert.strictEqual(alloc4.bucket.id, 'b-2');
    assert.strictEqual(bucketB.reservedStorageBytes, fiveHundredMiB);
  });

  it('plans distributed 20 GiB file across multiple buckets with 256 MiB chunks', async () => {
    const engine = new DynamicBucketAllocationEngine(DEFAULT_LOGICAL_QUOTA_BYTES);
    const planner = new ChunkDistributionPlanner(engine, DEFAULT_CHUNK_SIZE_BYTES);

    const bucket1: IStorageBucket = {
      id: 'b-1',
      bucketName: 'bucket-one',
      storageAccountId: 'acc-1',
      region: 'auto',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
      priority: 1,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const bucket2: IStorageBucket = {
      id: 'b-2',
      bucketName: 'bucket-two',
      storageAccountId: 'acc-2',
      region: 'auto',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
      priority: 2,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const bucket3: IStorageBucket = {
      id: 'b-3',
      bucketName: 'bucket-three',
      storageAccountId: 'acc-3',
      region: 'auto',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
      priority: 3,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const localProviders = new Map<string, LocalStorageProvider>();
    const getProvider = (accId: string) => {
      if (!localProviders.has(accId)) {
        localProviders.set(accId, new LocalStorageProvider(undefined, accId));
      }
      return localProviders.get(accId)!;
    };

    // 20 GiB file = 20 * 1024 * 1024 * 1024 bytes = 80 chunks of 256 MiB
    const twentyGiB = 20 * 1024 * 1024 * 1024;
    const plan = await planner.planDistribution(
      'file-20gib-demo',
      twentyGiB,
      [bucket1, bucket2, bucket3],
      getProvider
    );

    assert.strictEqual(plan.chunkCount, 80);
    assert.strictEqual(plan.isDistributed, true);
    assert.strictEqual(plan.chunks.length, 80);

    // Verify chunk 0 to 31 are allocated to bucket-one (32 * 256 MiB = 8 GiB)
    assert.strictEqual(plan.chunks[0].manifest.bucketId, 'b-1');
    assert.strictEqual(plan.chunks[31].manifest.bucketId, 'b-1');

    // Verify chunk 32 to 63 spilled over to bucket-two (32 * 256 MiB = 8 GiB)
    assert.strictEqual(plan.chunks[32].manifest.bucketId, 'b-2');
    assert.strictEqual(plan.chunks[63].manifest.bucketId, 'b-2');

    // Verify remaining chunks 64 to 79 spilled over to bucket-three (16 * 256 MiB = 4 GiB)
    assert.strictEqual(plan.chunks[64].manifest.bucketId, 'b-3');
    assert.strictEqual(plan.chunks[79].manifest.bucketId, 'b-3');
  });

  it('HTTP Range Gateway streams slices across multiple bucket chunks with exact byte order', async () => {
    const provider1 = new LocalStorageProvider(undefined, 'acc-1');
    const provider2 = new LocalStorageProvider(undefined, 'acc-2');

    // Write chunk 0 into Bucket 1 (contains "AAAAABBBBB")
    const chunk0Data = Buffer.from('AAAAABBBBB');
    await provider1.putObject('bucket-a', 'chunk_00.bin', chunk0Data, 'application/octet-stream');

    // Write chunk 1 into Bucket 2 (contains "CCCCCDDDDD")
    const chunk1Data = Buffer.from('CCCCCDDDDD');
    await provider2.putObject('bucket-b', 'chunk_01.bin', chunk1Data, 'application/octet-stream');

    const manifest: IFileManifest = {
      id: 'file-virtual-test',
      ownerId: 'user-1',
      originalFilename: 'test-combined.bin',
      mimeType: 'text/plain',
      totalSizeBytes: 20, // 10 bytes in chunk 0 + 10 bytes in chunk 1
      chunkCount: 2,
      chunkSizeBytes: 10,
      uploadStatus: FileUploadStatus.READY,
      processingStatus: VideoProcessingStatus.COMPLETED,
      isDistributed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      chunks: [
        {
          id: 'c0',
          fileId: 'file-virtual-test',
          chunkIndex: 0,
          storageAccountId: 'acc-1',
          bucketId: 'b-1',
          bucketName: 'bucket-a',
          objectKey: 'chunk_00.bin',
          byteStart: 0,
          byteEnd: 9,
          chunkSizeBytes: 10,
          status: ChunkUploadStatus.VERIFIED
        },
        {
          id: 'c1',
          fileId: 'file-virtual-test',
          chunkIndex: 1,
          storageAccountId: 'acc-2',
          bucketId: 'b-2',
          bucketName: 'bucket-b',
          objectKey: 'chunk_01.bin',
          byteStart: 10,
          byteEnd: 19,
          chunkSizeBytes: 10,
          status: ChunkUploadStatus.VERIFIED
        }
      ]
    };

    const gateway = new RangeDownloadGateway((accId) => (accId === 'acc-1' ? provider1 : provider2));

    // Request Range crossing chunks: byte 5 to 14 ("BBBBB" from chunk 0 + "CCCCC" from chunk 1)
    const res = await gateway.handleDownloadRequest(manifest, 'bytes=5-14');
    assert.strictEqual(res.statusCode, 206);
    assert.strictEqual(res.headers['Content-Range'], 'bytes 5-14/20');
    assert.strictEqual(res.headers['Content-Length'], 10);

    const chunksCollected: Buffer[] = [];
    for await (const chunk of res.stream) {
      chunksCollected.push(chunk as Buffer);
    }
    const resultBuffer = Buffer.concat(chunksCollected);
    assert.strictEqual(resultBuffer.toString(), 'BBBBBCCCCC');
  });

  it('verifies SHA-256 checksums correctly', async () => {
    const testData = Buffer.from('Antigravity Unified Media Engine Test');
    const expectedSha = ChecksumVerifier.computeBufferSha256(testData);

    const stream = Readable.from(testData);
    const computedSha = await ChecksumVerifier.computeStreamSha256(stream);

    assert.strictEqual(computedSha, expectedSha);
    assert.strictEqual(ChecksumVerifier.verifyChecksum(expectedSha, computedSha), true);
  });
});
