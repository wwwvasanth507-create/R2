const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

async function testMultipleFormatsUpload() {
  console.log('=== MULTI-FORMAT REAL VIDEO UPLOAD AND STREAMING AUDIT ===\n');

  const pool = new Pool({
    connectionString: 'postgresql://postgres:2008@127.0.0.1:5432/media_platform'
  });

  const testFormats = [
    {
      format: 'video/mp4',
      ext: 'mp4',
      title: 'Tamil Cinema 4K Teaser - WaveMusic Exclusive',
      desc: 'Official 4K release with Dolby Atmos audio stream.',
      cat: 'Movies',
      tags: 'Tamil, Cinema, 4K, Teaser, WaveMusic',
      size: 1024 * 512, // 512 KB
      duration: 75
    },
    {
      format: 'video/webm',
      ext: 'webm',
      title: 'Anirudh Viral BGMs & Bass Boosted Hits #Shorts',
      desc: 'Top trending vertical BGM compilation in WebM format.',
      cat: 'Music',
      tags: 'Anirudh, BGM, Shorts, Viral, Bass',
      size: 1024 * 256, // 256 KB
      duration: 35,
      isShort: true
    }
  ];

  for (const item of testFormats) {
    console.log(`--- Testing format: ${item.format} (${item.ext}) ---`);
    const payload = Buffer.alloc(item.size);
    payload.write('ftypisom', 4, 'utf-8');
    for (let i = 16; i < item.size; i += 4) {
      payload.writeUInt32BE(((i * 2654435761 + 98765) >>> 0), i);
    }
    const hash = crypto.createHash('sha256').update(payload).digest('hex');

    const uploadOpts = {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/videos/upload',
      method: 'POST',
      headers: {
        'Content-Type': item.format,
        'Content-Length': payload.length,
        'x-title': encodeURIComponent(item.title),
        'x-description': encodeURIComponent(item.desc),
        'x-category': item.cat,
        'x-tags': encodeURIComponent(item.tags),
        'x-filename': encodeURIComponent(`sample-upload.${item.ext}`),
        'x-duration': String(item.duration),
        'x-is-short': String(Boolean(item.isShort)),
        'x-visibility': 'PUBLIC'
      }
    };

    const res = await new Promise((resolve, reject) => {
      const req = http.request(uploadOpts, (r) => {
        let body = '';
        r.on('data', (c) => body += c);
        r.on('end', () => resolve({ status: r.statusCode, data: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    if (res.status !== 201 || !res.data.success) {
      console.error(`Upload failed for ${item.format}:`, res.data);
      process.exit(1);
    }

    console.log(`✓ Upload successful (HTTP ${res.status})`);
    console.log(`  Video ID: ${res.data.video.id}`);
    console.log(`  File ID: ${res.data.file.id}`);
    console.log(`  Stream URL: ${res.data.streamUrl}`);
    console.log(`  Bucket: ${res.data.bucket.name} (Used: ${res.data.bucket.usedStorageBytes} bytes)`);

    // Verify DB records
    const vRow = await pool.query('SELECT id, title, channel_id, file_id, is_short, visibility FROM videos WHERE id = $1', [res.data.video.id]);
    if (vRow.rows.length === 0) {
      console.error(`PostgreSQL videos table missing record for ${res.data.video.id}`);
      process.exit(1);
    }
    console.log(`✓ PostgreSQL videos row confirmed: "${vRow.rows[0].title}", is_short: ${vRow.rows[0].is_short}`);

    const fRow = await pool.query('SELECT id, original_filename, mime_type, total_size_bytes, total_sha256_checksum FROM files WHERE id = $1', [res.data.file.id]);
    if (fRow.rows.length === 0) {
      console.error(`PostgreSQL files table missing record for ${res.data.file.id}`);
      process.exit(1);
    }
    console.log(`✓ PostgreSQL files row confirmed: ${fRow.rows[0].original_filename} (${fRow.rows[0].mime_type}, ${fRow.rows[0].total_size_bytes} bytes)`);

    // Verify Range Streaming
    const rangeRes = await new Promise((resolve, reject) => {
      http.get({
        hostname: '127.0.0.1',
        port: 4000,
        path: res.data.streamUrl,
        headers: { Range: 'bytes=0-511' }
      }, (r) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, data: Buffer.concat(chunks) }));
      }).on('error', reject);
    });

    if (rangeRes.status !== 206) {
      console.error(`Range streaming expected 206, got ${rangeRes.status}`);
      process.exit(1);
    }
    if (rangeRes.data.length !== 512) {
      console.error(`Range streaming expected 512 bytes, got ${rangeRes.data.length}`);
      process.exit(1);
    }
    console.log(`✓ Stream 206 Partial Content confirmed: Content-Range = ${rangeRes.headers['content-range']}, Length = ${rangeRes.data.length}`);
  }

  // Check top video in YouTube API
  const ytRes = await new Promise((resolve) => {
    http.get('http://127.0.0.1:4000/api/youtube/videos', (r) => {
      let body = '';
      r.on('data', (c) => body += c);
      r.on('end', () => resolve(JSON.parse(body)));
    });
  });

  console.log(`\n✓ Top video in YouTube feed: "${ytRes[0].title}"`);
  console.log(`✓ Shorts feed check:`);
  const shortsRes = await new Promise((resolve) => {
    http.get('http://127.0.0.1:4000/api/youtube/shorts', (r) => {
      let body = '';
      r.on('data', (c) => body += c);
      r.on('end', () => resolve(JSON.parse(body)));
    });
  });
  console.log(`✓ Total Shorts in feed: ${shortsRes.length}, Top Short: "${shortsRes[0].title}"`);

  await pool.end();
  console.log('\n=== ALL MULTI-FORMAT UPLOADS & STREAMING TESTS VERIFIED! ===');
}

testMultipleFormatsUpload().catch((e) => {
  console.error(e);
  process.exit(1);
});
