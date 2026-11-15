const http = require('http');

function request(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('--- 1. Testing GET /api/admin/users ---');
  const usersRes = await request('GET', '/api/admin/users', null, { 'x-admin-key': 'VASAnth@2008' });
  console.log('GET users status:', usersRes.status, 'Total users:', Array.isArray(usersRes.data) ? usersRes.data.length : usersRes.data);

  console.log('\n--- 2. Testing POST /api/admin/users (Create new Uploader) ---');
  const createRes = await request('POST', '/api/admin/users', {
    username: 'tamil_cinema_uploader',
    email: 'uploader_tamil@wavemusic.dpdns.org',
    password: 'CinemaPassword@2026',
    displayName: 'Tamil Cinema HD',
    role: 'CREATOR'
  }, { 'x-admin-key': 'VASAnth@2008' });
  console.log('POST user status:', createRes.status, createRes.data);
  const newUserId = createRes.data?.user?.id;

  console.log('\n--- 3. Testing POST /api/auth/login with new uploader ---');
  const loginRes = await request('POST', '/api/auth/login', {
    emailOrUsername: 'tamil_cinema_uploader',
    password: 'CinemaPassword@2026'
  });
  console.log('Login status:', loginRes.status, 'User role:', loginRes.data?.user?.role);
  const uploaderToken = loginRes.data?.tokens?.accessToken;

  console.log('\n--- 4. Testing Uploader Authorization on Video Init ---');
  const authTest = await request('POST', '/api/videos/upload-init', {
    title: 'Test Uploader Video',
    filename: 'test.mp4',
    sizeBytes: 1048576,
    durationSeconds: 60
  }, { Authorization: `Bearer ${uploaderToken}` });
  console.log('Upload init status with uploader token:', authTest.status);

  console.log('\n--- 5. Testing PATCH /api/admin/users/:id (Edit uploader details) ---');
  const patchRes = await request('PATCH', `/api/admin/users/${newUserId}`, {
    displayName: 'Tamil Cinema Ultra HD 24K'
  }, { 'x-admin-key': 'VASAnth@2008' });
  console.log('PATCH user status:', patchRes.status, 'Updated displayName:', patchRes.data?.user?.displayName);

  console.log('\n--- 6. Testing DELETE /api/admin/users/:id (Delete uploader) ---');
  const deleteRes = await request('DELETE', `/api/admin/users/${newUserId}`, null, { 'x-admin-key': 'VASAnth@2008' });
  console.log('DELETE user status:', deleteRes.status, deleteRes.data);

  console.log('\n--- 7. Testing APK availability on web server ---');
  const apkReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/vd-player.apk',
    method: 'HEAD'
  }, (res) => {
    console.log('APK HTTP Status:', res.statusCode, 'Content-Length:', res.headers['content-length'], 'Content-Type:', res.headers['content-type']);
  });
  apkReq.end();
}

main().catch(console.error);
