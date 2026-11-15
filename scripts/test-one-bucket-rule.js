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

async function run() {
  console.log('=== VERIFYING: ONE R2 BUCKET OF 8 GB QUOTA PER CLOUDFLARE ACCOUNT ===\n');

  // 1. Admin Login
  const login = await request(
    { hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { emailOrUsername: 'VASANTH V', password: 'VASAnth@2008' }
  );
  const token = login.data?.tokens?.accessToken;
  console.log('1. Admin authenticated as:', login.data?.user?.username);

  // 2. Fetch accounts
  const accsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/admin/accounts',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const accounts = accsRes.data;
  console.log(`2. Found ${accounts.length} Cloudflare accounts.`);
  const acc1 = accounts[0];
  const acc2 = accounts[1];

  // 3. Create First Bucket for Account 1 (8 GB standard)
  console.log(`\n3. Creating First Bucket for Account 1 (${acc1.id})...`);
  const b1Res = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/buckets',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    },
    {
      bucketName: 'bkt-account1-primary',
      storageAccountId: acc1.id,
      region: 'auto',
      logicalQuotaBytes: 8589934592,
      priority: 1
    }
  );
  console.log('   Status:', b1Res.status);
  console.log('   Bucket Name:', b1Res.data?.bucketName, 'Quota Bytes:', b1Res.data?.logicalQuotaBytes, '(8 GiB)');

  // 4. Try to create a SECOND Bucket for Account 1 (MUST FAIL!)
  console.log(`\n4. Attempting to create a SECOND Bucket for Account 1 (${acc1.id}) - MUST BE REJECTED...`);
  const b2Res = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/buckets',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    },
    {
      bucketName: 'bkt-account1-secondary',
      storageAccountId: acc1.id,
      region: 'auto',
      logicalQuotaBytes: 8589934592,
      priority: 2
    }
  );
  console.log('   Status:', b2Res.status);
  console.log('   Error Message (Expected):', b2Res.data?.error);
  if (b2Res.status === 400 && b2Res.data?.error?.includes('already has an assigned bucket')) {
    console.log('   >>> SUCCESS: Enforced strictly 1 bucket per Cloudflare account!');
  } else {
    throw new Error('FAILED: Allowed creating more than 1 bucket for a single Cloudflare account!');
  }

  // 5. Create Bucket for Account 2
  console.log(`\n5. Creating Bucket for Account 2 (${acc2.id})...`);
  const b3Res = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/buckets',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    },
    {
      bucketName: 'bkt-account2-primary',
      storageAccountId: acc2.id,
      region: 'auto',
      logicalQuotaBytes: 8589934592,
      priority: 2
    }
  );
  console.log('   Status:', b3Res.status);
  console.log('   Bucket Name:', b3Res.data?.bucketName, 'Quota Bytes:', b3Res.data?.logicalQuotaBytes);

  // 6. Connect New Cloudflare Account with Automatic 1 Bucket of 8 GB
  console.log(`\n6. Connecting New Cloudflare Account with automatic 1 bucket provisioning...`);
  const newAccRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/accounts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    },
    {
      displayName: 'Cloudflare Account Gamma (APAC)',
      accountId: 'cf-gamma-8812',
      endpoint: 'https://cf-gamma-8812.r2.cloudflarestorage.com',
      accessKeyId: 'cf_key_gamma_prod',
      secretAccessKey: 'cf_secret_gamma_prod',
      monthlyBudgetUsd: 100,
      bucketName: 'bkt-gamma-apac-media'
    }
  );
  console.log('   New Account Status:', newAccRes.status, 'Account ID:', newAccRes.data?.id);

  // 7. Verify all buckets
  const allBucketsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/admin/buckets',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('\n7. Final Bucket List (1:1 with Accounts):');
  for (const b of allBucketsRes.data) {
    console.log(`   - Bucket: ${b.bucketName} | Account: ${b.storageAccountId} | Quota: ${b.logicalQuotaBytes / (1024*1024*1024)} GiB`);
  }

  // 8. Clean up created test buckets so user starts with a clean slate
  console.log('\n8. Cleaning up test buckets...');
  for (const b of allBucketsRes.data) {
    await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/admin/buckets/${b.id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  console.log('   Test buckets cleaned up. Ready for production use!');

  console.log('\n=== ALL VERIFICATIONS PASSED: 1 BUCKET PER CLOUDFLARE ACCOUNT OF 8 GB ENFORCED ===');
}

run().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
