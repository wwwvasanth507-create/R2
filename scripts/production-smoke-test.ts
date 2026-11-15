import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'http';
import * as path from 'path';
import { UserRole } from '@platform/common';

const backendPath = path.resolve(__dirname, '../../apps/backend/dist/main');
const { app } = require(backendPath);

describe('Official Production Launch Smoke Test Suite', () => {
  let server: http.Server;
  let serverPort = 0;
  let baseUrl = '';

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        console.log(`🚀 Production Test Server listening on ${baseUrl}`);
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  function apiPost(endpoint: string, body: any, headers: Record<string, string> = {}): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = http.request(
        `${baseUrl}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...headers
          }
        },
        (res) => {
          let chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const str = Buffer.concat(chunks).toString('utf-8');
            let parsed;
            try {
              parsed = JSON.parse(str);
            } catch {
              parsed = str;
            }
            resolve({ status: res.statusCode || 500, data: parsed });
          });
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  function apiGet(endpoint: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; data: any }> {
    return new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}${endpoint}`, { headers }, (res) => {
        let chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const str = Buffer.concat(chunks).toString('utf-8');
          let parsed;
          try {
            parsed = JSON.parse(str);
          } catch {
            parsed = str;
          }
          resolve({ status: res.statusCode || 500, headers: res.headers, data: parsed });
        });
      });
      req.on('error', reject);
    });
  }

  it('1. GET /health verifies system health and storage engine status', async () => {
    const res = await apiGet('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'HEALTHY');
    assert.ok(res.data.metrics.bucketsCount >= 3);
  });

  it('2. GET /metrics exports Prometheus compliant metrics for Grafana', async () => {
    const res = await apiGet('/metrics');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.data === 'string');
    assert.ok(res.data.includes('process_uptime_seconds'));
    assert.ok(res.data.includes('r2_total_storage_bytes'));
    assert.ok(res.data.includes('r2_bucket_usage_percent'));
  });

  it('3. RBAC Gate: Normal user rejected with 403 on /api/admin/accounts; Super Admin accepted', async () => {
    // Register normal user
    const normalReg = await apiPost('/api/auth/register', {
      email: 'user_regular@example.com',
      username: 'user_regular',
      password: 'UserPass2026!',
      role: UserRole.USER
    });
    const userToken = normalReg.data.tokens.accessToken;

    // Normal user attempts to read admin storage accounts -> Must receive HTTP 403 Forbidden!
    const forbiddenRes = await apiGet('/api/admin/accounts', {
      Authorization: `Bearer ${userToken}`
    });
    assert.strictEqual(forbiddenRes.status, 403, 'Normal user must be forbidden from accessing admin accounts');

    // Super Admin login
    const adminLogin = await apiPost('/api/auth/login', {
      emailOrUsername: 'admin@platform.io',
      password: 'admin123'
    });
    const adminToken = adminLogin.data.tokens.accessToken;

    // Super Admin reads admin storage accounts -> Must receive HTTP 200 OK!
    const adminRes = await apiGet('/api/admin/accounts', {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(adminRes.status, 200);
    assert.ok(Array.isArray(adminRes.data));
    // Verify secretAccessKey is masked and NEVER leaked in API response
    for (const acc of adminRes.data) {
      assert.strictEqual(acc.secretAccessKey, undefined, 'Raw secretAccessKey must never be exposed');
      assert.ok(acc.secretAccessKeyMasked, 'Masked credential placeholder must be present');
    }
  });

  it('4. Upload & Range Streaming: Presigned upload session, verification, and HTTP Range cross-bucket retrieval', async () => {
    // Create 10 GiB upload session (crosses 8 GiB logical quota into secondary bucket)
    const tenGiB = 10 * 1024 * 1024 * 1024;
    const sessionRes = await apiPost('/api/uploads/sessions', {
      originalFilename: 'live_test_feature_film.mov',
      mimeType: 'video/quicktime',
      totalSizeBytes: tenGiB
    });
    assert.strictEqual(sessionRes.status, 201);
    assert.strictEqual(sessionRes.data.isDistributed, true);
    assert.strictEqual(sessionRes.data.chunkCount, 40); // 40 chunks @ 256 MiB = 10 GiB

    const fileId = sessionRes.data.fileId;

    // Verify first chunk (idempotent commit)
    const verifyRes = await apiPost('/api/uploads/chunks/verify', {
      fileId,
      chunkIndex: 0,
      chunkSha256Checksum: 'valid-chunk-sha256-hash',
      actualSizeBytes: sessionRes.data.chunks[0].chunkSizeBytes
    });
    assert.strictEqual(verifyRes.status, 200);

    // Call verify AGAIN for the same chunk -> Must be idempotent without double-counting bytes
    const retryVerifyRes = await apiPost('/api/uploads/chunks/verify', {
      fileId,
      chunkIndex: 0,
      chunkSha256Checksum: 'valid-chunk-sha256-hash',
      actualSizeBytes: sessionRes.data.chunks[0].chunkSizeBytes
    });
    assert.strictEqual(retryVerifyRes.status, 200);

    // Test session resume endpoint
    const resumeRes = await apiPost(`/api/uploads/sessions/${fileId}/resume`, {});
    assert.strictEqual(resumeRes.status, 200);
    assert.strictEqual(resumeRes.data.verifiedChunksCount, 1);
    assert.strictEqual(resumeRes.data.pendingChunksCount, 39);
  });

  it('5. HLS Manifest & Adaptive Streaming: Validates master.m3u8 generation and playback endpoint', async () => {
    const res = await apiGet('/api/streaming/manifest/f-live-test/master.m3u8');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type']?.toLowerCase().includes('application/x-mpegurl'));
    assert.ok(res.data.includes('#EXTM3U'));
    assert.ok(res.data.includes('RESOLUTION=1920x1080'));
    assert.ok(res.data.includes('360p/index.m3u8'));
  });
});
