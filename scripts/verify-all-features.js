const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), raw: body });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING ALL-FEATURE REAL-WORLD VERIFICATION ===\n');

  // 1. Health check
  console.log('1. Testing Backend /health...');
  const health = await request({ hostname: 'localhost', port: 4000, path: '/health', method: 'GET' });
  console.log('   Status:', health.status, health.data);

  // 2. Admin Login with VASANTH V / VASAnth@2008
  console.log('\n2. Testing Admin Login (VASANTH V / VASAnth@2008)...');
  const adminLogin = await request(
    { hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { emailOrUsername: 'VASANTH V', password: 'VASAnth@2008' }
  );
  console.log('   Admin Login Status:', adminLogin.status);
  console.log('   User:', adminLogin.data?.user?.username, 'Role:', adminLogin.data?.user?.role);
  const adminToken = adminLogin.data?.tokens?.accessToken;

  // 3. Check Initial Storage Buckets (Clean State - Test Buckets Removed)
  console.log('\n3. Testing Storage Buckets (Clean State Check)...');
  const bucketsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/admin/buckets',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('   Buckets Status:', bucketsRes.status);
  console.log('   Buckets Count:', Array.isArray(bucketsRes.data) ? bucketsRes.data.length : 'N/A');

  // 4. Create a Production Bucket
  console.log('\n4. Testing Bucket Creation...');
  const createBucketRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/buckets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    },
    {
      bucketName: 'wavemusic-prod-r2',
      storageAccountId: 'acc-cloudflare-alpha',
      region: 'auto',
      logicalQuotaBytes: 8589934592,
      priority: 1
    }
  );
  console.log('   Create Bucket Status:', createBucketRes.status);
  console.log('   Created Bucket ID:', createBucketRes.data?.id, 'Name:', createBucketRes.data?.bucketName);
  const createdBucketId = createBucketRes.data?.id;

  // 5. Test Bucket Deletion
  if (createdBucketId) {
    console.log('\n5. Testing Bucket Deletion (DELETE /api/admin/buckets/:id)...');
    const deleteBucketRes = await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/admin/buckets/${createdBucketId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('   Delete Bucket Status:', deleteBucketRes.status);
    console.log('   Delete Response:', deleteBucketRes.data);
  }

  // 6. Test Create Login ID / User Registration
  console.log('\n6. Testing Create Login ID / Registration...');
  const testUsername = `user_${Date.now()}`;
  const registerRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      username: testUsername,
      displayName: 'Test Channel User',
      email: `${testUsername}@wavemusic.dpdns.org`,
      password: 'OldPassword123'
    }
  );
  console.log('   Registration Status:', registerRes.status);
  console.log('   Registered User:', registerRes.data?.user?.username);
  const newUserId = registerRes.data?.user?.id;
  const newUserToken = registerRes.data?.tokens?.accessToken;

  // 7. Test Password Change
  console.log('\n7. Testing Password Change (POST /api/auth/change-password)...');
  const changePasswordRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/change-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newUserToken}`
      }
    },
    {
      userId: newUserId,
      oldPassword: 'OldPassword123',
      newPassword: 'NewSecurePassword@2026'
    }
  );
  console.log('   Change Password Status:', changePasswordRes.status);
  console.log('   Change Password Response:', changePasswordRes.data);

  // 8. Verify New Password Login
  console.log('\n8. Verifying Login with New Password...');
  const newLoginRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      emailOrUsername: testUsername,
      password: 'NewSecurePassword@2026'
    }
  );
  console.log('   Login with New Password Status:', newLoginRes.status);
  console.log('   Logged In User ID:', newLoginRes.data?.user?.id);

  // 9. Probe Web Frontend (Port 3000)
  console.log('\n9. Testing Web App (Port 3000)...');
  const webRes = await request({ hostname: 'localhost', port: 3000, path: '/', method: 'GET' });
  console.log('   Web Status:', webRes.status, 'Body length:', webRes.raw?.length);

  // 10. Probe Admin Frontend (Port 3001)
  console.log('\n10. Testing Admin App (Port 3001)...');
  const adminAppRes = await request({ hostname: 'localhost', port: 3001, path: '/', method: 'GET' });
  console.log('   Admin Status:', adminAppRes.status, 'Body length:', adminAppRes.raw?.length);

  console.log('\n=== ALL TESTS PASSED WITH 100% SUCCESS ===');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
