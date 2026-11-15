import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Readable } from 'stream';
import {
  DEFAULT_LOGICAL_QUOTA_BYTES,
  DEFAULT_CHUNK_SIZE_BYTES,
  BucketHealthStatus,
  FileUploadStatus,
  ChunkUploadStatus,
  IStorageBucket,
  IFileManifest
} from '@platform/common';
import {
  DynamicBucketAllocationEngine,
  ChunkDistributionPlanner,
  RangeDownloadGateway,
  RangeNotSatisfiableError,
  ChecksumVerifier,
  LocalStorageProvider
} from '@platform/storage-engine';

describe('Real-World Large File Upload & Distributed Range Gateway Audit', () => {
  const logicalQuota = DEFAULT_LOGICAL_QUOTA_BYTES; // 8 GiB = 8,589,934,592 bytes
  const chunkSize = DEFAULT_CHUNK_SIZE_BYTES;       // 256 MiB = 268,435,456 bytes

  const createTestBuckets = (): IStorageBucket[] => [
    {
      id: 'bkt-alpha',
      bucketName: 'bucket-alpha',
      storageAccountId: 'acc-alpha',
      region: 'auto',
      logicalQuotaBytes: logicalQuota,
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: logicalQuota,
      priority: 1,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'bkt-beta',
      bucketName: 'bucket-beta',
      storageAccountId: 'acc-beta',
      region: 'auto',
      logicalQuotaBytes: logicalQuota,
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: logicalQuota,
      priority: 2,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'bkt-gamma',
      bucketName: 'bucket-gamma',
      storageAccountId: 'acc-gamma',
      region: 'auto',
      logicalQuotaBytes: logicalQuota,
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: logicalQuota,
      priority: 3,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const providers = new Map<string, LocalStorageProvider>();
  const getProvider = (accId: string) => {
    if (!providers.has(accId)) {
      providers.set(accId, new LocalStorageProvider(undefined, accId));
    }
    return providers.get(accId)!;
  };

  it('verifies chunk sizing and planning across 100MB, 500MB, 2GB, 8GB, 12GB, and 20GB files', async () => {
    const testCases = [
      { sizeName: '100 MB', bytes: 100 * 1024 * 1024, expectedChunks: 1, expectedDistributed: false },
      { sizeName: '500 MB', bytes: 500 * 1024 * 1024, expectedChunks: 2, expectedDistributed: false },
      { sizeName: '2 GB', bytes: 2 * 1024 * 1024 * 1024, expectedChunks: 8, expectedDistributed: false },
      { sizeName: '8 GiB', bytes: 8 * 1024 * 1024 * 1024, expectedChunks: 32, expectedDistributed: false },
      { sizeName: '12 GiB', bytes: 12 * 1024 * 1024 * 1024, expectedChunks: 48, expectedDistributed: true },
      { sizeName: '20 GiB', bytes: 20 * 1024 * 1024 * 1024, expectedChunks: 80, expectedDistributed: true }
    ];

    for (const tc of testCases) {
      const buckets = createTestBuckets();
      const engine = new DynamicBucketAllocationEngine(logicalQuota);
      const planner = new ChunkDistributionPlanner(engine, chunkSize);

      const plan = await planner.planDistribution(
        `test-${tc.sizeName.replace(/\s+/g, '_')}`,
        tc.bytes,
        buckets,
        getProvider
      );

      assert.strictEqual(plan.chunkCount, tc.expectedChunks, `Chunk count mismatch for ${tc.sizeName}`);
      assert.strictEqual(plan.isDistributed, tc.expectedDistributed, `Distribution mismatch for ${tc.sizeName}`);

      // Verify that no bucket exceeded its 8 GiB logical quota
      for (const bucket of buckets) {
        const totalCommitted = bucket.usedStorageBytes + bucket.reservedStorageBytes;
        assert.ok(
          totalCommitted <= logicalQuota,
          `Bucket ${bucket.id} exceeded 8 GiB quota: ${totalCommitted} > ${logicalQuota}`
        );
      }
    }
  });

  it('performs interrupted upload simulation and resumes without re-uploading finished chunks', async () => {
    const buckets = createTestBuckets();
    const engine = new DynamicBucketAllocationEngine(logicalQuota);
    const planner = new ChunkDistributionPlanner(engine, chunkSize);

    // Simulate an upload of 1 GiB = 4 chunks of 256 MiB
    const oneGiB = 1 * 1024 * 1024 * 1024;
    const plan = await planner.planDistribution('session-interrupted', oneGiB, buckets, getProvider);
    assert.strictEqual(plan.chunks.length, 4);

    // 1. Upload & verify Chunk 0 and Chunk 1 (first 500 MiB)
    plan.chunks[0].manifest.status = ChunkUploadStatus.VERIFIED;
    engine.commitReservation(buckets[0], {
      id: plan.chunks[0].reservationId,
      bucketId: buckets[0].id,
      fileId: 'session-interrupted',
      chunkIndex: 0,
      reservedBytes: plan.chunks[0].manifest.chunkSizeBytes,
      expiresAt: new Date(),
      isCommitted: false,
      createdAt: new Date()
    });

    plan.chunks[1].manifest.status = ChunkUploadStatus.VERIFIED;
    engine.commitReservation(buckets[0], {
      id: plan.chunks[1].reservationId,
      bucketId: buckets[0].id,
      fileId: 'session-interrupted',
      chunkIndex: 1,
      reservedBytes: plan.chunks[1].manifest.chunkSizeBytes,
      expiresAt: new Date(),
      isCommitted: false,
      createdAt: new Date()
    });

    // 2. Simulate interruption/network disconnect!
    // Chunks 2 and 3 remain PENDING
    assert.strictEqual(plan.chunks[2].manifest.status, ChunkUploadStatus.PENDING);
    assert.strictEqual(plan.chunks[3].manifest.status, ChunkUploadStatus.PENDING);

    // 3. Resuming client asks which chunks require uploading:
    const pendingChunks = plan.chunks.filter((c) => c.manifest.status !== ChunkUploadStatus.VERIFIED);
    assert.strictEqual(pendingChunks.length, 2, 'Only unverified chunks 2 and 3 must be returned for upload');
    assert.strictEqual(pendingChunks[0].manifest.chunkIndex, 2);
    assert.strictEqual(pendingChunks[1].manifest.chunkIndex, 3);

    // 4. Client completes chunks 2 and 3
    plan.chunks[2].manifest.status = ChunkUploadStatus.VERIFIED;
    plan.chunks[3].manifest.status = ChunkUploadStatus.VERIFIED;

    const allVerified = plan.chunks.every((c) => c.manifest.status === ChunkUploadStatus.VERIFIED);
    assert.strictEqual(allVerified, true);
  });

  it('HTTP Range Gateway: Full download, HEAD, Single-chunk, Cross-chunk, Cross-bucket, and 416', async () => {
    const provA = getProvider('acc-alpha');
    const provB = getProvider('acc-beta');

    // Bucket A: Chunk 0 contains "1234567890" (10 bytes)
    await provA.putObject('bucket-alpha', 'c0.bin', Buffer.from('1234567890'), 'application/octet-stream');
    // Bucket B: Chunk 1 contains "ABCDEFGHIJ" (10 bytes)
    await provB.putObject('bucket-beta', 'c1.bin', Buffer.from('ABCDEFGHIJ'), 'application/octet-stream');

    const manifest: IFileManifest = {
      id: 'f-cross-bucket-demo',
      ownerId: 'usr-1',
      originalFilename: 'cross_bucket.bin',
      mimeType: 'text/plain',
      totalSizeBytes: 20,
      chunkCount: 2,
      chunkSizeBytes: 10,
      uploadStatus: FileUploadStatus.READY,
      processingStatus: undefined as any,
      isDistributed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      chunks: [
        {
          id: 'chk-0',
          fileId: 'f-cross-bucket-demo',
          chunkIndex: 0,
          storageAccountId: 'acc-alpha',
          bucketId: 'bkt-alpha',
          bucketName: 'bucket-alpha',
          objectKey: 'c0.bin',
          byteStart: 0,
          byteEnd: 9,
          chunkSizeBytes: 10,
          status: ChunkUploadStatus.VERIFIED
        },
        {
          id: 'chk-1',
          fileId: 'f-cross-bucket-demo',
          chunkIndex: 1,
          storageAccountId: 'acc-beta',
          bucketId: 'bkt-beta',
          bucketName: 'bucket-beta',
          objectKey: 'c1.bin',
          byteStart: 10,
          byteEnd: 19,
          chunkSizeBytes: 10,
          status: ChunkUploadStatus.VERIFIED
        }
      ]
    };

    const gateway = new RangeDownloadGateway((accId) => (accId === 'acc-alpha' ? provA : provB));

    // 1. HTTP HEAD test
    const headRes = gateway.handleHeadRequest(manifest);
    assert.strictEqual(headRes.statusCode, 200);
    assert.strictEqual(headRes.headers['Content-Length'], 20);
    assert.strictEqual(headRes.headers['Accept-Ranges'], 'bytes');

    // 2. Full Download (bytes=0-19)
    const fullRes = await gateway.handleDownloadRequest(manifest);
    assert.strictEqual(fullRes.statusCode, 200);
    assert.strictEqual(fullRes.headers['Content-Length'], 20);
    const fullBuf = await streamToBuffer(fullRes.stream);
    assert.strictEqual(fullBuf.toString(), '1234567890ABCDEFGHIJ');

    // 3. Single-chunk Range (bytes=2-6: "34567" from Chunk 0)
    const singleRes = await gateway.handleDownloadRequest(manifest, 'bytes=2-6');
    assert.strictEqual(singleRes.statusCode, 206);
    assert.strictEqual(singleRes.headers['Content-Range'], 'bytes 2-6/20');
    const singleBuf = await streamToBuffer(singleRes.stream);
    assert.strictEqual(singleBuf.toString(), '34567');

    // 4. Critical Cross-Bucket Range (bytes=7-14: "890" from Bucket A + "ABCDE" from Bucket B)
    const crossRes = await gateway.handleDownloadRequest(manifest, 'bytes=7-14');
    assert.strictEqual(crossRes.statusCode, 206);
    assert.strictEqual(crossRes.headers['Content-Range'], 'bytes 7-14/20');
    assert.strictEqual(crossRes.headers['Content-Length'], 8);
    const crossBuf = await streamToBuffer(crossRes.stream);
    assert.strictEqual(crossBuf.toString(), '890ABCDE');

    // 5. Unsatisfiable Range (bytes=100-200 on a 20-byte file -> MUST return HTTP 416)
    const invalidRes = await gateway.handleDownloadRequest(manifest, 'bytes=100-200');
    assert.strictEqual(invalidRes.statusCode, 416);
    assert.strictEqual(invalidRes.headers['Content-Range'], 'bytes */20');
  });
});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
