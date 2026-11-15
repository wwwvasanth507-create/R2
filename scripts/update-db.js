const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:2008@127.0.0.1:5432/media_platform'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL media_platform');

    // Update Super Admin user
    await client.query(`
      UPDATE users 
      SET username = 'VASANTH V', 
          display_name = 'VASANTH V', 
          password_hash = 'VASAnth@2008',
          email = 'vasanth@wavemusic.dpdns.org'
      WHERE role = 'SUPER_ADMIN' OR username = 'admin' OR email = 'admin@platform.io';
    `);
    console.log('Admin user updated to VASANTH V / VASAnth@2008');

    // Remove test buckets
    const delRes = await client.query(`DELETE FROM storage_buckets WHERE bucket_name LIKE 'prod-media-%';`);
    console.log(`Removed ${delRes.rowCount} test storage buckets`);

    const users = await client.query(`SELECT id, username, email, role FROM users;`);
    console.log('Current users:', users.rows);

    const buckets = await client.query(`SELECT id, bucket_name FROM storage_buckets;`);
    console.log('Current buckets:', buckets.rows);

    await client.end();
  } catch (err) {
    console.error('Database update error:', err);
    process.exit(1);
  }
}

main();
