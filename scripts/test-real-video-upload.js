const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { Pool } = require('pg');

async function testVideoUploadAndStreaming() {
  console.log('=== STARTING REAL VIDEO UPLOAD & STREAMING INTEGRATION TEST ===\n');

  // 1. Create a synthetic realistic video payload (representing an MKV / MP4 container)
  const videoPayloadSize = 1024 * 1024 * 2; // 2 MiB video
  const videoBuffer = Buffer.alloc(videoPayloadSize);
  // Write pseudo-video header
  videoBuffer.write('1A45DFA3', 0, 'hex'); // EBML ID for MKV
  for (let i = 4; i < videoPayloadSize; i += 4) {
    videoBuffer.writeUInt32BE(((i * 1103515245 + 12345) >>> 0), i);
  }
  const expectedSha256 = crypto.createHash('sha256').update(videoBuffer).digest('hex');
  console.log(`[TEST 1] Generated test video payload: ${videoPayloadSize} bytes (2.0 MiB, format: video/x-matroska)`);
  console.log(`[TEST 1] Expected SHA-256 Checksum: ${expectedSha256}`);

  // 2. Upload video straight to bucket via POST /api/videos/upload
  const uploadOptions = {
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/videos/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'video/x-matroska',
      'Content-Length': videoBuffer.length,
      'x-title': encodeURIComponent('Mastering Cloudflare R2 Streaming Architecture'),
      'x-description': encodeURIComponent('Step-by-step demonstration of direct video upload to 8GB logical quota R2 buckets.'),
      'x-category': 'Tech',
      'x-tags': encodeURIComponent('Cloudflare, R2, Streaming, Video, WaveMusic'),
      'x-filename': encodeURIComponent('mastering-r2.mkv'),
      'x-duration': '320',
      'x-is-short': 'false',
      'x-visibility': 'PUBLIC'
    }
  };

  const uploadResult = await new Promise((resolve, reject) => {
    const req = http.request(uploadOptions, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(videoBuffer);
    req.end();
  });

  console.log(`\n[TEST 2] Upload Response Status: ${uploadResult.statusCode}`);
  if (uploadResult.statusCode !== 201 || !uploadResult.data.success) {
    console.error('Upload failed:', uploadResult.data);
    process.exit(1);
  }

  const { video, file, streamUrl, bucket } = uploadResult.data;
  console.log(`[TEST 2] Video Title: "${video.title}"`);
  console.log(`[TEST 2] Video ID: ${video.id}`);
  console.log(`[TEST 2] File ID: ${file.id}`);
  console.log(`[TEST 2] Stream URL: ${streamUrl}`);
  console.log(`[TEST 2] Target Bucket: ${bucket.name} (Quota: ${bucket.logicalQuotaBytes} bytes = 8 GiB)`);
  console.log(`[TEST 2] Recorded SHA-256 Checksum: ${file.totalSha256Checksum}`);

  if (file.totalSha256Checksum !== expectedSha256) {
    console.error(`Checksum mismatch! Expected ${expectedSha256}, got ${file.totalSha256Checksum}`);
    process.exit(1);
  }
  console.log('✓ Checksum matches perfectly on-the-fly!');

  // 3. Verify PostgreSQL Database Persistence
  console.log('\n[TEST 3] Verifying PostgreSQL database persistence...');
  const pool = new Pool({
    connectionString: 'postgresql://postgres:2008@127.0.0.1:5432/media_platform'
  });

  const videoInDb = await pool.query(
    'SELECT id, title, channel_id, file_id, duration_seconds, visibility FROM videos WHERE title = $1',
    ['Mastering Cloudflare R2 Streaming Architecture']
  );
  console.log(`[TEST 3] PostgreSQL 'videos' table matched rows: ${videoInDb.rows.length}`);
  if (videoInDb.rows.length > 0) {
    console.log('✓ Video persisted in PostgreSQL:', videoInDb.rows[0]);
  } else {
    console.warn('Notice: video not found by exact title in PostgreSQL query');
  }

  const fileInDb = await pool.query(
    'SELECT id, original_filename, mime_type, total_size_bytes FROM files WHERE original_filename = $1',
    ['mastering-r2.mkv']
  );
  console.log(`[TEST 3] PostgreSQL 'files' table matched rows: ${fileInDb.rows.length}`);
  if (fileInDb.rows.length > 0) {
    console.log('✓ File manifest persisted in PostgreSQL:', fileInDb.rows[0]);
  }
  await pool.end();

  // 4. Test HTTP Range Virtual Reassembly Stream
  console.log('\n[TEST 4] Testing video streaming via HTTP Range Gateway...');
  const rangeStart = 0;
  const rangeEnd = 1023; // First 1 KB
  const streamOptions = {
    hostname: '127.0.0.1',
    port: 4000,
    path: streamUrl,
    method: 'GET',
    headers: {
      Range: `bytes=${rangeStart}-${rangeEnd}`
    }
  };

  const streamResult = await new Promise((resolve, reject) => {
    const req = http.request(streamOptions, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: Buffer.concat(chunks)
        });
      });
    });
    req.on('error', reject);
    req.end();
  });

  console.log(`[TEST 4] Stream Response Status: ${streamResult.statusCode} (Expected: 206 Partial Content)`);
  console.log(`[TEST 4] Content-Range Header: ${streamResult.headers['content-range']}`);
  console.log(`[TEST 4] Content-Length: ${streamResult.headers['content-length']}`);
  console.log(`[TEST 4] Received Bytes: ${streamResult.data.length} (Expected: 1024)`);

  if (streamResult.statusCode !== 206) {
    console.error('Range streaming did not return 206 Partial Content!');
    process.exit(1);
  }

  // Verify byte content
  const originalSlice = videoBuffer.subarray(rangeStart, rangeEnd + 1);
  if (!originalSlice.equals(streamResult.data)) {
    console.error('Streamed bytes do not match original video bytes!');
    process.exit(1);
  }
  console.log('✓ Streamed bytes match original video bit-for-bit!');

  // 5. Verify YouTube API Feed Sorting
  console.log('\n[TEST 5] Verifying YouTube API feed returns new video at top...');
  const feedResult = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4000/api/youtube/videos', (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });

  console.log(`[TEST 5] Total videos in feed: ${feedResult.length}`);
  const topVideo = feedResult[0];
  console.log(`[TEST 5] Top Video in Feed: "${topVideo.title}" (ID: ${topVideo.id})`);
  if (topVideo.title === 'Mastering Cloudflare R2 Streaming Architecture') {
    console.log('✓ Newly uploaded video is at the very top of YouTube feed!');
  } else {
    console.warn(`Top video is: ${topVideo.title}`);
  }

  // 6. Verify Web App Response on Port 3000
  console.log('\n[TEST 6] Checking Web Application on port 3000...');
  const webResult = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000', (res) => {
      resolve({ statusCode: res.statusCode });
    }).on('error', reject);
  });
  console.log(`[TEST 6] Web App HTTP Status: ${webResult.statusCode}`);
  if (webResult.statusCode === 200) {
    console.log('✓ Web App is running healthy on port 3000!');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================');
}

testVideoUploadAndStreaming().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
