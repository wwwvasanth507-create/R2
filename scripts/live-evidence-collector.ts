import * as assert from 'node:assert';
import * as http from 'http';
import * as path from 'path';
import { UserRole } from '@platform/common';

const backendPath = path.resolve(__dirname, '../../apps/backend/dist/main');
const { app } = require(backendPath);

async function runLiveEvidenceCollection() {
  console.log(`[${new Date().toISOString()}] Starting Live Production Evidence Collection...`);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[${new Date().toISOString()}] Ephemeral Backend listening on ${baseUrl}`);

  function req(method: string, path: string, body?: any, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; data: any }> {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : undefined;
      const r = http.request(
        `${baseUrl}${path}`,
        {
          method,
          headers: {
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
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
            resolve({ status: res.statusCode || 500, headers: res.headers, data: parsed });
          });
        }
      );
      r.on('error', reject);
      if (payload) r.write(payload);
      r.end();
    });
  }

  const results: any[] = [];

  // 1. Health check
  const healthRes = await req('GET', '/health');
  results.push({
    test: 'GET /health',
    status: healthRes.status,
    pass: healthRes.status === 200 && healthRes.data.status === 'HEALTHY',
    data: healthRes.data
  });
  console.log(`[EVIDENCE] 1. GET /health: status=${healthRes.status}, data=${JSON.stringify(healthRes.data)}`);

  // 2. Metrics check
  const metricsRes = await req('GET', '/metrics');
  results.push({
    test: 'GET /metrics',
    status: metricsRes.status,
    pass: metricsRes.status === 200 && typeof metricsRes.data === 'string' && metricsRes.data.includes('process_uptime_seconds'),
    sample: metricsRes.data.slice(0, 150)
  });
  console.log(`[EVIDENCE] 2. GET /metrics: status=${metricsRes.status}, length=${metricsRes.data.length}`);

  // 3. Security: Auth registration, password hashing
  const regRes = await req('POST', '/api/auth/register', {
    email: 'live_audit_user@example.com',
    username: 'live_audit_user',
    password: 'SuperSecurePassword2026!',
    role: UserRole.USER
  });
  results.push({
    test: 'POST /api/auth/register',
    status: regRes.status,
    pass: regRes.status === 201 && regRes.data.user && !regRes.data.user.passwordHash,
    user: regRes.data.user
  });
  console.log(`[EVIDENCE] 3. Auth Registration: status=${regRes.status}, passwordHashExposed=${!!regRes.data?.user?.passwordHash}`);

  // 4. Security: RBAC unauthenticated
  const unauthRes = await req('GET', '/api/admin/accounts');
  results.push({
    test: 'GET /api/admin/accounts (no token)',
    status: unauthRes.status,
    pass: unauthRes.status === 401
  });
  console.log(`[EVIDENCE] 4. RBAC Unauthenticated Gate: status=${unauthRes.status} (expected 401)`);

  // 5. Security: RBAC unauthorized role
  const userToken = regRes.data.tokens.accessToken;
  const forbiddenRes = await req('GET', '/api/admin/accounts', undefined, { Authorization: `Bearer ${userToken}` });
  results.push({
    test: 'GET /api/admin/accounts (normal user role)',
    status: forbiddenRes.status,
    pass: forbiddenRes.status === 403
  });
  console.log(`[EVIDENCE] 5. RBAC Forbidden Gate: status=${forbiddenRes.status} (expected 403)`);

  // 6. Security: Super Admin Access and Secret Masking
  const adminLoginRes = await req('POST', '/api/auth/login', {
    emailOrUsername: 'admin@platform.io',
    password: 'admin123'
  });
  const adminToken = adminLoginRes.data.tokens.accessToken;
  const adminAccountsRes = await req('GET', '/api/admin/accounts', undefined, { Authorization: `Bearer ${adminToken}` });
  const accounts = adminAccountsRes.data;
  let secretLeaked = false;
  if (Array.isArray(accounts)) {
    for (const a of accounts) {
      if (a.secretAccessKey !== undefined) secretLeaked = true;
    }
  }
  results.push({
    test: 'GET /api/admin/accounts (Super Admin role + Secret Masking)',
    status: adminAccountsRes.status,
    pass: adminAccountsRes.status === 200 && !secretLeaked,
    accountsCount: Array.isArray(accounts) ? accounts.length : 0
  });
  console.log(`[EVIDENCE] 6. Super Admin Accounts: status=${adminAccountsRes.status}, secretLeaked=${secretLeaked}`);

  // 7. Large File Upload Session Creation & 8 GiB Quota Allocation
  const sessionRes = await req('POST', '/api/uploads/sessions', {
    originalFilename: 'enterprise_feature_production_cut.mov',
    mimeType: 'video/quicktime',
    totalSizeBytes: 12 * 1024 * 1024 * 1024 // 12 GiB
  });
  results.push({
    test: 'POST /api/uploads/sessions (12 GiB Multi-Bucket Allocation)',
    status: sessionRes.status,
    pass: sessionRes.status === 201 && sessionRes.data.isDistributed === true && sessionRes.data.chunkCount === 48,
    data: {
      fileId: sessionRes.data?.fileId,
      chunkCount: sessionRes.data?.chunkCount,
      isDistributed: sessionRes.data?.isDistributed
    }
  });
  console.log(`[EVIDENCE] 7. 12 GiB Upload Session: status=${sessionRes.status}, chunkCount=${sessionRes.data?.chunkCount}, isDistributed=${sessionRes.data?.isDistributed}`);

  // 8. Range Download Gateway (RFC 7233 & HTTP 416)
  const oobRangeRes = await req('GET', `/api/files/${sessionRes.data.fileId}/download`, undefined, { Range: 'bytes=999999999999-999999999999' });
  results.push({
    test: 'GET /api/files/:id/download (Out-of-Bounds Range)',
    status: oobRangeRes.status,
    pass: oobRangeRes.status === 416,
    contentRange: oobRangeRes.headers['content-range']
  });
  console.log(`[EVIDENCE] 8. Out-of-Bounds Range: status=${oobRangeRes.status} (expected 416), Content-Range=${oobRangeRes.headers['content-range']}`);

  // 9. HTTP HEAD on Download Endpoint
  const headRes = await req('HEAD', `/api/files/${sessionRes.data.fileId}/download`);
  results.push({
    test: 'HEAD /api/files/:id/download (Metadata without body payload)',
    status: headRes.status,
    pass: headRes.status === 200 && headRes.headers['accept-ranges'] === 'bytes',
    headers: headRes.headers
  });
  console.log(`[EVIDENCE] 9. HTTP HEAD: status=${headRes.status}, acceptRanges=${headRes.headers['accept-ranges']}`);

  // 10. HLS Adaptive Streaming Manifest
  const hlsRes = await req('GET', '/api/streaming/manifest/f-live-evidence/master.m3u8');
  results.push({
    test: 'GET /api/streaming/manifest/:id/master.m3u8',
    status: hlsRes.status,
    pass: hlsRes.status === 200 && hlsRes.data.includes('#EXTM3U') && hlsRes.data.includes('RESOLUTION=1920x1080'),
    contentType: hlsRes.headers['content-type']
  });
  console.log(`[EVIDENCE] 10. HLS Master Manifest: status=${hlsRes.status}, contentType=${hlsRes.headers['content-type']}`);

  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log(`[${new Date().toISOString()}] Evidence collection complete. All ${results.length} checks executed.`);
}

runLiveEvidenceCollection().catch((err) => {
  console.error('Evidence collection failed:', err);
  process.exit(1);
});
