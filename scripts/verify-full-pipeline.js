const http = require('http');
const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
  database: process.env.PGDATABASE || process.env.DB_NAME || 'media_platform',
  user: process.env.PGUSER || process.env.DB_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '2008',
});

const ADMIN_TOKEN = 'mock_admin_jwt_VASANTH_V';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const isHttps = options.protocol === 'https:';
    const client = isHttps ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json || data
        });
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING END-TO-END VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  // 1. Check Backend Health
  try {
    const res = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/health',
      method: 'GET'
    });
    if (res.statusCode === 200 && res.data.status === 'HEALTHY') {
      console.log('✅ TEST 1: Backend Health Check (status=HEALTHY) PASSED');
      passed++;
    } else {
      console.error('❌ TEST 1: Backend Health Check FAILED', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 1: Backend Health Check Error', err);
    failed++;
  }

  // 2. Add Cloudflare Storage Account via API
  let createdAccountId = '';
  try {
    const res = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/accounts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    }, {
      displayName: 'CF Verification Team Account',
      accountId: `cf_account_${Date.now()}`,
      accessKeyId: 'cf_key_test_12345',
      secretAccessKey: 'cf_secret_test_67890abcdef',
      endpoint: 'https://cf_account.r2.cloudflarestorage.com'
    });

    if (res.statusCode === 201 && res.data.id) {
      createdAccountId = res.data.id;
      // Check PostgreSQL
      const dbRes = await pool.query('SELECT * FROM storage_accounts WHERE id = $1', [createdAccountId]);
      if (dbRes.rows.length === 1 && dbRes.rows[0].display_name === 'CF Verification Team Account') {
        console.log(`✅ TEST 2: Storage Account Creation & PostgreSQL Persistence PASSED. ID: ${createdAccountId}`);
        passed++;
      } else {
        console.error('❌ TEST 2: Account not found in PostgreSQL', dbRes.rows);
        failed++;
      }
    } else {
      console.error('❌ TEST 2: Account Creation Failed', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 2 Error', err);
    failed++;
  }

  // 3. Add Bucket to Account (enforcing 8 GiB quota)
  let createdBucketId = '';
  const bucketName1 = `bkt-media-test-${Date.now()}`;
  try {
    const res = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/buckets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    }, {
      bucketName: bucketName1,
      storageAccountId: createdAccountId,
      logicalQuotaBytes: 8589934592, // 8 GiB
      region: 'auto'
    });

    if (res.statusCode === 201 && res.data.id) {
      createdBucketId = res.data.id;
      // Check PostgreSQL
      const dbRes = await pool.query('SELECT * FROM storage_buckets WHERE id = $1', [createdBucketId]);
      if (dbRes.rows.length === 1 && BigInt(dbRes.rows[0].logical_quota_bytes) === BigInt(8589934592)) {
        console.log(`✅ TEST 3: Bucket Creation & 8 GiB Quota in PostgreSQL PASSED. Bucket ID: ${createdBucketId}`);
        passed++;
      } else {
        console.error('❌ TEST 3: Bucket not persisted in PostgreSQL', dbRes.rows);
        failed++;
      }
    } else {
      console.error('❌ TEST 3: Bucket Creation Failed', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 3 Error', err);
    failed++;
  }

  // 4. Update / Replace Bucket for Account (testing 1-bucket rule replacement)
  const replacedBucketName = `bkt-replaced-${Date.now()}`;
  try {
    const res = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/buckets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    }, {
      bucketName: replacedBucketName,
      storageAccountId: createdAccountId,
      logicalQuotaBytes: 8589934592,
      region: 'auto'
    });

    if ((res.statusCode === 200 || res.statusCode === 201) && res.data.bucketName === replacedBucketName) {
      // Check PostgreSQL: only 1 bucket must exist for this account
      const dbRes = await pool.query('SELECT * FROM storage_buckets WHERE storage_account_id = $1', [createdAccountId]);
      if (dbRes.rows.length === 1 && dbRes.rows[0].bucket_name === replacedBucketName) {
        console.log(`✅ TEST 4: 1-Bucket-Per-Account Replacement Policy PASSED. Active bucket: ${replacedBucketName}`);
        passed++;
      } else {
        console.error('❌ TEST 4: Expected 1 bucket after replacement, found:', dbRes.rows);
        failed++;
      }
    } else {
      console.error('❌ TEST 4: Bucket Replacement Failed', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 4 Error', err);
    failed++;
  }

  // 5. Delete Bucket via API
  try {
    const res = await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/admin/buckets/${createdBucketId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    if (res.statusCode === 200 && res.data.success) {
      const dbRes = await pool.query('SELECT * FROM storage_buckets WHERE id = $1', [createdBucketId]);
      if (dbRes.rows.length === 0) {
        console.log(`✅ TEST 5: Bucket Deletion from Memory & PostgreSQL PASSED. Deleted ID: ${createdBucketId}`);
        passed++;
      } else {
        console.error('❌ TEST 5: Bucket still present in PostgreSQL', dbRes.rows);
        failed++;
      }
    } else {
      console.error('❌ TEST 5: Bucket Deletion Failed', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 5 Error', err);
    failed++;
  }

  // 6. Delete Account via API
  try {
    const res = await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/admin/accounts/${createdAccountId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    if (res.statusCode === 200 && res.data.success) {
      const dbRes = await pool.query('SELECT * FROM storage_accounts WHERE id = $1', [createdAccountId]);
      if (dbRes.rows.length === 0) {
        console.log(`✅ TEST 6: Account Deletion from Memory & PostgreSQL PASSED. Deleted ID: ${createdAccountId}`);
        passed++;
      } else {
        console.error('❌ TEST 6: Account still present in PostgreSQL', dbRes.rows);
        failed++;
      }
    } else {
      console.error('❌ TEST 6: Account Deletion Failed', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 6 Error', err);
    failed++;
  }

  // 7. Video Thumbnail Upload (Body JSON, no header overflow)
  let thumbnailUrl = '';
  try {
    const fakeBase64Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const res = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/videos/upload-thumbnail',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      dataUrl: fakeBase64Png
    });

    if ((res.statusCode === 200 || res.statusCode === 201) && res.data.success && (res.data.url || res.data.thumbnailUrl)) {
      thumbnailUrl = res.data.url || res.data.thumbnailUrl;
      console.log('✅ TEST 7: Thumbnail Upload via Body JSON (Fix 431) PASSED. URL:', thumbnailUrl);
      passed++;
    } else {
      console.error('❌ TEST 7: Thumbnail Upload Failed', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 7 Error', err);
    failed++;
  }

  // 8. Video Binary Upload (Simulating Browser XHR with Query Params)
  let videoId = '';
  let streamPath = '';
  try {
    const testVideoBuffer = Buffer.alloc(1024 * 1024, 0x55); // 1 MB test video binary
    const qParams = new URLSearchParams({
      title: 'Real Pipeline Verification Video 2',
      category: 'Entertainment',
      tags: 'test,verification,e2e',
      thumbnailUrl: thumbnailUrl
    });

    const res = await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/videos/upload?${qParams.toString()}`,
      method: 'POST',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': testVideoBuffer.length.toString()
      }
    }, testVideoBuffer);

    if ((res.statusCode === 200 || res.statusCode === 201) && res.data.video && res.data.video.id) {
      videoId = res.data.video.id;
      streamPath = res.data.streamUrl || `/api/files/${res.data.file.id}/download`;
      // Check PostgreSQL
      const dbRes = await pool.query('SELECT * FROM videos WHERE id = $1', [videoId]);
      if (dbRes.rows.length === 1 && dbRes.rows[0].title === 'Real Pipeline Verification Video 2') {
        console.log(`✅ TEST 8: Video Binary Upload & PostgreSQL Registration PASSED. Video ID: ${videoId}`);
        passed++;
      } else {
        console.error('❌ TEST 8: Video not found in PostgreSQL', dbRes.rows);
        failed++;
      }
    } else {
      console.error('❌ TEST 8: Video Binary Upload Failed', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 8 Error', err);
    failed++;
  }

  // 9. Video Streaming with HTTP Range
  if (streamPath) {
    try {
      const res = await request({
        hostname: 'localhost',
        port: 4000,
        path: streamPath,
        method: 'GET',
        headers: {
          'Range': 'bytes=0-1023'
        }
      });

      if (res.statusCode === 206 && res.headers['content-range']) {
        console.log(`✅ TEST 9: HTTP Range Streaming (206 Partial Content) PASSED. Range: ${res.headers['content-range']}`);
        passed++;
      } else {
        console.error('❌ TEST 9: HTTP Range Streaming Failed', res.statusCode, res.headers);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 9 Error', err);
      failed++;
    }
  }

  // 10. Web App and Admin App Response Check
  try {
    const webRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    const adminRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/',
      method: 'GET'
    });

    if (webRes.statusCode === 200 && adminRes.statusCode === 200) {
      console.log('✅ TEST 10: Next.js Web App (3000) and Admin App (3001) Responding with 200 OK PASSED');
      passed++;
    } else {
      console.error('❌ TEST 10: Port 3000 or 3001 returned non-200', webRes.statusCode, adminRes.statusCode);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 10 Error', err);
    failed++;
  }

  await pool.end();
  console.log(`\n==============================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==============================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
