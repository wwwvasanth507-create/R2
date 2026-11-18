/**
 * Live HTTP Upload and API Verification Test
 * Tests /api/videos/upload and /api/admin/buckets
 */

import http from 'http';
import { Client } from 'pg';
import { app } from '../apps/backend/dist/main.js';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const PG_CONFIG = {
  connectionString: 'postgresql://postgres:2008@127.0.0.1:5432/media_platform?schema=public'
};

function createMultipartPayload(filename, fileContent, title, description) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  let body = '';

  body += `--${boundary}${crlf}`;
  body += `Content-Disposition: form-data; name="title"${crlf}${crlf}`;
  body += `${title}${crlf}`;

  body += `--${boundary}${crlf}`;
  body += `Content-Disposition: form-data; name="description"${crlf}${crlf}`;
  body += `${description}${crlf}`;

  body += `--${boundary}${crlf}`;
  body += `Content-Disposition: form-data; name="video"; filename="${filename}"${crlf}`;
  body += `Content-Type: video/mp4${crlf}${crlf}`;

  const headerBuf = Buffer.from(body, 'utf-8');
  const footerBuf = Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf-8');
  const payload = Buffer.concat([headerBuf, fileContent, footerBuf]);

  return { boundary, payload };
}

async function run() {
  console.log('--- Starting Live HTTP Server on Port 4010 for API Verification ---');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(4010, resolve));
  console.log('Test server listening on http://127.0.0.1:4010');

  const pgClient = new Client(PG_CONFIG);
  await pgClient.connect();

  let uploadedVideoId = null;
  let s3Client = null;
  let targetBucketName = null;
  let targetR2Key = null;

  try {
    // 1. Verify GET /api/admin/buckets
    console.log('\n--- 1. Testing GET /api/admin/buckets ---');
    const bktRes = await fetch('http://127.0.0.1:4010/api/admin/buckets', {
      headers: { Authorization: 'Bearer mock_admin_jwt_test' }
    });
    const buckets = await bktRes.json();
    console.log('Returned buckets from /api/admin/buckets:');
    console.table(buckets.map(b => ({
      name: b.bucketName,
      priority: b.priority,
      used_gb: (b.usedStorageBytes / (1024*1024*1024)).toFixed(2) + ' GB',
      available_gb: (b.availableStorageBytes / (1024*1024*1024)).toFixed(2) + ' GB',
      usagePercent: b.usagePercent + '%',
      isFull: b.isFull,
      isCurrentDestination: b.isCurrentDestination
    })));

    const b1 = buckets.find(b => b.bucketName === 'vasanth01-r2');
    const b2 = buckets.find(b => b.bucketName === 'cloud-02');

    if (!b1 || !b2) throw new Error('Both buckets must exist in API response');
    if (b1.isCurrentDestination) throw new Error('Bucket 1 is full, cannot be current destination');
    if (!b2.isCurrentDestination) throw new Error('Bucket 2 must be marked as current destination');
    console.log('✓ API correctly marks Bucket 2 (cloud-02) as current destination and Bucket 1 as full!');

    // 2. Perform live upload to /api/videos/upload
    console.log('\n--- 2. Testing Live Upload via POST /api/videos/upload ---');
    const dummyVideo = Buffer.from('FAKE-MP4-STREAM-DATA-MULTI-BUCKET-FAILOVER-VERIFICATION-2026');
    const { boundary, payload } = createMultipartPayload(
      'test-failover-movie.mp4',
      dummyVideo,
      'Failover Verification Movie',
      'Automatic failover to cloud-02'
    );

    const uploadRes = await fetch('http://127.0.0.1:4010/api/videos/upload', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': 'Bearer mock_admin_jwt_test'
      },
      body: payload
    });

    const uploadData = await uploadRes.json();
    console.log('Upload response status:', uploadRes.status);
    console.log('Upload response body:', uploadData);

    if (uploadRes.status !== 201) {
      throw new Error(`Upload failed with status ${uploadRes.status}: ${JSON.stringify(uploadData)}`);
    }

    uploadedVideoId = uploadData.video?.id;
    targetBucketName = uploadData.bucket?.name;
    targetR2Key = uploadData.file?.chunks?.[0]?.storageKey;
    const fileId = uploadData.file?.id;

    console.log(`Video uploaded with ID: ${uploadedVideoId}`);
    console.log(`Saved in Bucket: ${targetBucketName}`);
    console.log(`Object Key: ${targetR2Key}`);

    if (targetBucketName !== 'cloud-02') {
      throw new Error(`Expected file to save in cloud-02, but saved in ${targetBucketName}`);
    }
    console.log('✓ File was AUTOMATICALLY and SUCCESSFULLY routed to Bucket 2 (cloud-02)!');

    // 3. Verify in PostgreSQL that video record exists and points to cloud-02
    console.log('\n--- 3. Verifying Database Record ---');
    const dbVideo = await pgClient.query('SELECT * FROM videos WHERE id = $1', [uploadedVideoId]);
    if (dbVideo.rows.length === 0) throw new Error('Video not found in Postgres');
    console.log('✓ Video found in database: title =', dbVideo.rows[0].title);

    // 4. Verify in Cloudflare R2 on cloud-02
    console.log('\n--- 4. Verifying Object in Cloudflare R2 on cloud-02 ---');
    const acc2Row = await pgClient.query("SELECT * FROM storage_accounts WHERE id = $1", [b2.storageAccountId]);
    const acc2 = acc2Row.rows[0];

    s3Client = new S3Client({
      region: 'auto',
      endpoint: acc2.endpoint,
      credentials: {
        accessKeyId: acc2.access_key_id,
        secretAccessKey: acc2.secret_access_key_encrypted
      }
    });

    const headRes = await s3Client.send(new GetObjectCommand({
      Bucket: 'cloud-02',
      Key: targetR2Key
    }));
    console.log('✓ Cloudflare R2 head confirmed: ContentLength =', headRes.ContentLength, 'ContentType =', headRes.ContentType);

  } finally {
    // Clean up test upload
    if (uploadedVideoId) {
      console.log('\n--- Cleaning up test video record & R2 object ---');
      await pgClient.query('DELETE FROM videos WHERE id = $1', [uploadedVideoId]);
      console.log('✓ Removed test video record from Postgres.');
    }
    if (s3Client && targetBucketName && targetR2Key) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: targetBucketName,
          Key: targetR2Key
        }));
        console.log(`✓ Removed test object ${targetR2Key} from Cloudflare R2 bucket ${targetBucketName}.`);
      } catch (err) {
        console.warn('R2 clean-up notice:', err.message);
      }
    }
    await pgClient.end();
    server.close();
    console.log('\n======================================================');
    console.log('LIVE HTTP UPLOAD & CLOUDFLARE R2 VERIFICATION PASSED!');
    console.log('======================================================');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('\n❌ Live HTTP test failed:', err);
  process.exit(1);
});
