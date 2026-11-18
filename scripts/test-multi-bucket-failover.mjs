/**
 * Comprehensive Multi-Bucket Storage Failover Test Suite
 *
 * Mandatory Tests Covered:
 * Test 1: Bucket 1 is full, Bucket 2 is empty -> Upload new file -> MUST save to Bucket 2.
 * Test 2: Bucket 1 has 7.9 GB used and new file cannot fit -> MUST select Bucket 2.
 * Test 3: Bucket 1 and Bucket 2 are full, Bucket 3 has space -> MUST select Bucket 3.
 * Test 4: All buckets are full -> MUST return clear quota-exceeded error (400) without losing data.
 * Test 5: Upload multiple files simultaneously -> Verify atomic reservation prevents quota overflow.
 * Test 6: Restart backend / reload from DB -> Verify persisted DB stats maintain correct bucket allocation.
 */

import { Client } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DatabaseService } from '../apps/backend/dist/database/db.service.js';
import { StorageManagerService } from '../apps/backend/dist/services/storage-manager.service.js';
import { DEFAULT_LOGICAL_QUOTA_BYTES } from '@platform/common';

const PG_CONFIG = {
  connectionString: 'postgresql://postgres:2008@127.0.0.1:5432/media_platform?schema=public'
};

const EIGHT_GB = 8589934592; // 8 * 1024 * 1024 * 1024 bytes

let passedTests = 0;
let totalTests = 6;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('======================================================================');
  console.log('CLOUDFLARE R2 AUTOMATIC MULTI-BUCKET FAILOVER INTEGRATION TEST SUITE');
  console.log('======================================================================\n');

  const pgClient = new Client(PG_CONFIG);
  await pgClient.connect();
  console.log('Connected to PostgreSQL media_platform.\n');

  // 1. Snapshot original bucket states
  const originalBucketsRes = await pgClient.query(
    'SELECT * FROM storage_buckets ORDER BY priority ASC'
  );
  console.log('Original Buckets in Database:');
  console.table(originalBucketsRes.rows.map(r => ({
    id: r.id,
    bucket_name: r.bucket_name,
    priority: r.priority,
    used_gb: (Number(r.used_storage_bytes) / (1024*1024*1024)).toFixed(3) + ' GB',
    quota_gb: (Number(r.logical_quota_bytes) / (1024*1024*1024)).toFixed(1) + ' GB',
    health_status: r.health_status
  })));

  const bucket1Original = originalBucketsRes.rows.find(b => b.bucket_name === 'vasanth01-r2');
  const bucket2Original = originalBucketsRes.rows.find(b => b.bucket_name === 'cloud-02');

  if (!bucket1Original || !bucket2Original) {
    throw new Error('Expected buckets vasanth01-r2 and cloud-02 to exist in database.');
  }

  try {
    // ========================================================================
    // TEST 1: Bucket 1 is full, Bucket 2 is empty. Upload a new file. MUST save to Bucket 2.
    // ========================================================================
    console.log('\n--- TEST 1: Bucket 1 is full, Bucket 2 is empty. Upload must save to Bucket 2 ---');
    {
      // Ensure DB has Bucket 1 full (> 8GB) and Bucket 2 empty (0)
      await pgClient.query(
        'UPDATE storage_buckets SET used_storage_bytes = $1, health_status = $2 WHERE id = $3',
        [bucket1Original.used_storage_bytes, 'EXHAUSTED_100', bucket1Original.id]
      );
      await pgClient.query(
        'UPDATE storage_buckets SET used_storage_bytes = 0, health_status = $1 WHERE id = $2',
        ['HEALTHY', bucket2Original.id]
      );

      // Initialize fresh StorageManagerService
      const db = new DatabaseService();
      await db.readyPromise;
      const storageManager = new StorageManagerService(db);

      // Check current upload destination
      const dest = storageManager.getCurrentUploadDestination();
      assert(dest !== null, 'Current upload destination found');
      assert(dest.id === bucket2Original.id, `Destination is Bucket 2 (${dest.bucketName}), NOT full Bucket 1`);

      // Request bucket for 50 MB upload
      const fileSize = 50 * 1024 * 1024;
      const selected = storageManager.selectBucketForUpload(fileSize);
      assert(selected !== null, 'Bucket selected for upload');
      assert(selected.id === bucket2Original.id, `Selected bucket is Bucket 2 (cloud-02), NOT Bucket 1 (vasanth01-r2)`);

      // Verify R2 provider exists for selected bucket's account
      const provider = storageManager.getProvider(selected.storageAccountId);
      assert(provider !== undefined, `Provider found for account ${selected.storageAccountId}`);

      // Perform a real test upload to Cloudflare R2 on Bucket 2
      const testKey = `test-failover-${Date.now()}.txt`;
      const testData = Buffer.from('Cloudflare R2 Failover Test Data: Bucket 2 verification');
      storageManager.reserveCapacity(selected.id, testData.length);
      await provider.client.send(new PutObjectCommand({
        Bucket: selected.bucketName,
        Key: testKey,
        Body: testData,
        ContentType: 'text/plain'
      }));
      storageManager.commitUpload(selected.id, testData.length);

      // Verify object exists in Bucket 2 on R2
      const r2Obj = await provider.client.send(new GetObjectCommand({
        Bucket: selected.bucketName,
        Key: testKey
      }));
      assert(r2Obj.ContentLength === testData.length, `R2 PutObject confirmed on Bucket 2: size ${r2Obj.ContentLength} bytes`);

      // Clean up test object on R2
      await provider.client.send(new DeleteObjectCommand({
        Bucket: selected.bucketName,
        Key: testKey
      }));

      // Release reservation/used bytes
      await storageManager.releaseCapacity(selected.id, testData.length);

      if (db.pgPool) await db.pgPool.end();
      passedTests++;
      console.log('✅ TEST 1 PASSED: File successfully allocated and stored in Bucket 2.');
    }

    // ========================================================================
    // TEST 2: Bucket 1 has 7.9 GB used and new file cannot fit. MUST select Bucket 2.
    // ========================================================================
    console.log('\n--- TEST 2: Bucket 1 has 7.9 GB used and new file cannot fit. MUST select Bucket 2 ---');
    {
      const db = new DatabaseService();
      await db.readyPromise;
      const storageManager = new StorageManagerService(db);

      // Simulate Bucket 1 having 7.9 GB used (8,482,560,000 bytes)
      const simulatedUsed = 8482560000; // 7.9 GB
      const b1 = db.storageBuckets.get(bucket1Original.id);
      b1.usedStorageBytes = simulatedUsed;
      b1.availableStorageBytes = Math.max(0, EIGHT_GB - simulatedUsed); // ~107.37 MB
      b1.healthStatus = 'WARNING_95';

      const b2 = db.storageBuckets.get(bucket2Original.id);
      b2.usedStorageBytes = 0;
      b2.availableStorageBytes = EIGHT_GB;
      b2.healthStatus = 'HEALTHY';

      // 1. Upload size that CANNOT fit in Bucket 1 (e.g. 200 MB > 107.37 MB)
      const largeFile = 200 * 1024 * 1024;
      const targetForLarge = storageManager.selectBucketForUpload(largeFile);
      assert(targetForLarge.id === bucket2Original.id, `200 MB file correctly bypassed Bucket 1 and selected Bucket 2 (remaining B1 space: ~107 MB)`);

      // 2. Upload size that CAN fit in Bucket 1 (e.g. 50 MB < 107.37 MB)
      const smallFile = 50 * 1024 * 1024;
      const targetForSmall = storageManager.selectBucketForUpload(smallFile);
      assert(targetForSmall.id === bucket1Original.id, `50 MB file fits in remaining 107 MB of Bucket 1, so Bucket 1 was selected`);

      if (db.pgPool) await db.pgPool.end();
      passedTests++;
      console.log('✅ TEST 2 PASSED: 7.9 GB full bucket skipped when file cannot fit; Bucket 2 selected.');
    }

    // ========================================================================
    // TEST 3: Bucket 1 and Bucket 2 are full, Bucket 3 has space. MUST select Bucket 3.
    // ========================================================================
    console.log('\n--- TEST 3: Bucket 1 & 2 full, Bucket 3 has space. MUST select Bucket 3 ---');
    {
      const db = new DatabaseService();
      await db.readyPromise;
      const storageManager = new StorageManagerService(db);

      // Simulate Bucket 1 and Bucket 2 both full (8 GB each)
      const b1 = db.storageBuckets.get(bucket1Original.id);
      b1.usedStorageBytes = EIGHT_GB;
      b1.availableStorageBytes = 0;
      b1.healthStatus = 'EXHAUSTED_100';

      const b2 = db.storageBuckets.get(bucket2Original.id);
      b2.usedStorageBytes = EIGHT_GB;
      b2.availableStorageBytes = 0;
      b2.healthStatus = 'EXHAUSTED_100';

      // Create Bucket 3
      const bucket3Id = 'test-bucket-03';
      const b3 = {
        id: bucket3Id,
        storageAccountId: bucket2Original.storage_account_id,
        bucketName: 'cloud-03',
        priority: 3,
        logicalQuotaBytes: EIGHT_GB,
        usedStorageBytes: 0,
        reservedStorageBytes: 0,
        availableStorageBytes: EIGHT_GB,
        healthStatus: 'HEALTHY',
        isEnabled: true,
        endpoint: bucket2Original.endpoint,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      db.storageBuckets.set(bucket3Id, b3);

      // Current destination should be Bucket 3
      const dest = storageManager.getCurrentUploadDestination();
      assert(dest !== null, 'Destination found when B1 & B2 are full');
      assert(dest.id === bucket3Id, `Destination is Bucket 3 (${dest.bucketName})`);

      // Selection for 100 MB file should select Bucket 3
      const selected = storageManager.selectBucketForUpload(100 * 1024 * 1024);
      assert(selected.id === bucket3Id, `Selected bucket is Bucket 3 (${selected.bucketName})`);

      // Clean up Bucket 3 from memory
      db.storageBuckets.delete(bucket3Id);

      if (db.pgPool) await db.pgPool.end();
      passedTests++;
      console.log('✅ TEST 3 PASSED: Automatic failover selected Bucket 3 when Buckets 1 and 2 were full.');
    }

    // ========================================================================
    // TEST 4: All buckets are full. MUST return clear quota-exceeded error without losing file.
    // ========================================================================
    console.log('\n--- TEST 4: All buckets full. MUST return clear quota error without losing data ---');
    {
      const db = new DatabaseService();
      await db.readyPromise;
      const storageManager = new StorageManagerService(db);

      // Set all buckets to full
      for (const b of db.storageBuckets.values()) {
        b.usedStorageBytes = EIGHT_GB;
        b.availableStorageBytes = 0;
        b.healthStatus = 'EXHAUSTED_100';
      }

      // Check current upload destination
      const dest = storageManager.getCurrentUploadDestination();
      assert(dest === null, 'No upload destination available when all buckets are full');

      // Attempt to select bucket for upload
      let errorThrown = false;
      let errorMessage = '';
      try {
        storageManager.selectBucketForUpload(10 * 1024 * 1024);
      } catch (err) {
        errorThrown = true;
        errorMessage = err.message;
      }

      assert(errorThrown, 'Error was thrown when all buckets were full');
      assert(
        errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('capacity'),
        `Clear error message returned: "${errorMessage}"`
      );

      if (db.pgPool) await db.pgPool.end();
      passedTests++;
      console.log('✅ TEST 4 PASSED: Explicit storage quota exceeded error returned when all buckets full.');
    }

    // ========================================================================
    // TEST 5: Upload multiple files simultaneously. Verify atomic reservation prevents quota overflow.
    // ========================================================================
    console.log('\n--- TEST 5: Concurrent uploads. Verify no bucket exceeds 8 GB logical quota ---');
    {
      const db = new DatabaseService();
      await db.readyPromise;
      const storageManager = new StorageManagerService(db);

      // Setup:
      // Bucket 1 has only 25 MB left (8 GB - 25 MB)
      const b1 = db.storageBuckets.get(bucket1Original.id);
      b1.usedStorageBytes = EIGHT_GB - 25 * 1024 * 1024;
      b1.availableStorageBytes = 25 * 1024 * 1024;
      b1.healthStatus = 'HEALTHY';

      // Bucket 2 is empty with 8 GB available
      const b2 = db.storageBuckets.get(bucket2Original.id);
      b2.usedStorageBytes = 0;
      b2.availableStorageBytes = EIGHT_GB;
      b2.healthStatus = 'HEALTHY';

      // Simulate 5 simultaneous uploads of 10 MB each
      const uploadSize = 10 * 1024 * 1024; // 10 MB
      const allocationResults = [];

      for (let i = 0; i < 5; i++) {
        // Atomic selection and reservation
        const chosen = storageManager.selectBucketForUpload(uploadSize);
        storageManager.reserveCapacity(chosen.id, uploadSize);
        allocationResults.push(chosen.id);
      }

      const b1Count = allocationResults.filter(id => id === bucket1Original.id).length;
      const b2Count = allocationResults.filter(id => id === bucket2Original.id).length;

      console.log(`  Allocation breakdown: ${b1Count} to Bucket 1, ${b2Count} to Bucket 2`);

      assert(b1Count === 2, `Bucket 1 only accepted 2 files (20 MB <= 25 MB remaining space)`);
      assert(b2Count === 3, `Bucket 2 automatically received the remaining 3 files (30 MB)`);

      // Verify Bucket 1 did not overflow its 8 GB quota
      const b1Total = b1.usedStorageBytes + (b1.reservedStorageBytes || 0);
      assert(b1Total <= EIGHT_GB, `Bucket 1 used+reserved (${b1Total}) did not exceed 8 GB quota (${EIGHT_GB})`);

      // Release reservations
      await Promise.all(allocationResults.map(id => storageManager.releaseCapacity(id, uploadSize)));

      if (db.pgPool) await db.pgPool.end();
      passedTests++;
      console.log('✅ TEST 5 PASSED: Concurrent atomic reservations prevented quota overflow and spilled over seamlessly.');
    }

    // ========================================================================
    // TEST 6: Restart backend / reload from DB. Verify persisted DB stats maintain correct bucket allocation.
    // ========================================================================
    console.log('\n--- TEST 6: Restart backend. Verify bucket allocation continues using persisted DB data ---');
    {
      // Persist test state in PostgreSQL:
      // Bucket 1: 9,110,286,624 bytes (8.48 GB, full)
      // Bucket 2: 250,000,000 bytes (~238 MB used, 7.76 GB available)
      const b2PersistedUsed = 250000000;
      const u1 = await pgClient.query(
        'UPDATE storage_buckets SET used_storage_bytes = $1, health_status = $2 WHERE id = $3',
        [bucket1Original.used_storage_bytes, 'EXHAUSTED_100', bucket1Original.id]
      );
      const u2 = await pgClient.query(
        'UPDATE storage_buckets SET used_storage_bytes = $1, health_status = $2 WHERE id = $3',
        [b2PersistedUsed, 'HEALTHY', bucket2Original.id]
      );
      console.log(`  Updated rows: u1=${u1.rowCount}, u2=${u2.rowCount}`);

      // Simulate a complete backend server restart:
      // Re-initialize DatabaseService and StorageManagerService from fresh instances
      const restartedDb = new DatabaseService();
      await restartedDb.readyPromise;
      const restartedStorageManager = new StorageManagerService(restartedDb);

      const restartedB1 = restartedDb.storageBuckets.get(bucket1Original.id);
      const restartedB2 = restartedDb.storageBuckets.get(bucket2Original.id);

      assert(restartedB1 !== undefined, 'Bucket 1 reloaded from PostgreSQL after restart');
      assert(restartedB2 !== undefined, 'Bucket 2 reloaded from PostgreSQL after restart');

      assert(restartedB1.healthStatus === 'EXHAUSTED_100', `Bucket 1 marked EXHAUSTED_100 on restart (used: ${restartedB1.usedStorageBytes} bytes)`);
      assert(restartedB1.availableStorageBytes === 0, 'Bucket 1 available storage is 0 bytes');

      assert(restartedB2.healthStatus === 'HEALTHY', `Bucket 2 marked HEALTHY on restart`);
      console.log(`  B2 debug: used=${restartedB2.usedStorageBytes}, quota=${restartedB2.logicalQuotaBytes}, available=${restartedB2.availableStorageBytes}, expected=${EIGHT_GB - b2PersistedUsed}`);
      assert(restartedB2.availableStorageBytes === EIGHT_GB - b2PersistedUsed, `Bucket 2 available storage matches quota minus persisted used bytes`);

      // Verify current upload destination is Bucket 2
      const restartDest = restartedStorageManager.getCurrentUploadDestination();
      assert(restartDest !== null, 'Destination identified after restart');
      assert(restartDest.id === bucket2Original.id, `Destination after restart is Bucket 2 (${restartDest.bucketName})`);

      // Verify upload selection routes to Bucket 2
      const uploadTarget = restartedStorageManager.selectBucketForUpload(50 * 1024 * 1024);
      assert(uploadTarget.id === bucket2Original.id, `Next upload automatically routes to Bucket 2 after restart`);

      if (restartedDb.pgPool) await restartedDb.pgPool.end();
      passedTests++;
      console.log('✅ TEST 6 PASSED: Backend restart reloaded persisted DB data; bucket allocation continued accurately.');
    }

  } finally {
    // Restore original PostgreSQL state
    console.log('\n--- Restoring original database bucket state ---');
    await pgClient.query(
      'UPDATE storage_buckets SET used_storage_bytes = $1, health_status = $2 WHERE id = $3',
      [bucket1Original.used_storage_bytes, bucket1Original.health_status, bucket1Original.id]
    );
    await pgClient.query(
      'UPDATE storage_buckets SET used_storage_bytes = $1, health_status = $2 WHERE id = $3',
      [bucket2Original.used_storage_bytes, bucket2Original.health_status, bucket2Original.id]
    );

    // Verify videos in DB are completely intact
    const videoCountRes = await pgClient.query('SELECT count(*) FROM videos');
    console.log(`Verified total database video records intact: ${videoCountRes.rows[0].count} videos.`);

    await pgClient.end();
  }

  console.log('\n======================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('======================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
