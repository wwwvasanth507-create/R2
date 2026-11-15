const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'media_platform',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '2008',
});

async function cleanTestData() {
  console.log('=== PERMANENTLY REMOVING ALL TEST DATA ===');

  try {
    const keepVideoId = '8f751c84-f52a-40b8-a9c0-6c091da1ebe6';

    // 1. Delete comments for test videos
    await pool.query('DELETE FROM video_comments WHERE video_id != $1', [keepVideoId]);
    console.log('[OK] Cleaned video_comments for test videos.');

    // 2. Delete test videos
    const vidRes = await pool.query('DELETE FROM videos WHERE id != $1 RETURNING id, title', [keepVideoId]);
    console.log(`[OK] Deleted ${vidRes.rowCount} test videos. Retained real video: "${keepVideoId}"`);

    // 3. Delete file_chunks for test files
    const keepFiles = ['45515900-e8ec-454a-9110-8dcfe3b7ba2c', 'f0000000-0000-0000-0000-794757552165'];
    await pool.query('DELETE FROM file_chunks WHERE file_id NOT IN ($1, $2)', keepFiles);
    console.log('[OK] Cleaned file_chunks for test files.');

    // 4. Delete test files
    const fileRes = await pool.query('DELETE FROM files WHERE id NOT IN ($1, $2) RETURNING id, original_filename', keepFiles);
    console.log(`[OK] Deleted ${fileRes.rowCount} test files. Retained real video & thumbnail files.`);

    // 5. Clean test storage buckets
    const keepBucketName = 'vasanth01-r2';
    const bktRes = await pool.query('DELETE FROM storage_buckets WHERE bucket_name != $1 RETURNING id, bucket_name', [keepBucketName]);
    console.log(`[OK] Deleted ${bktRes.rowCount} test buckets. Retained real R2 bucket: "${keepBucketName}"`);

    // 6. Clean test storage accounts
    const keepAccountId = 'b1c96ced5a4ea4721dd1401426d4b7fc';
    const accRes = await pool.query('DELETE FROM storage_accounts WHERE account_id != $1 RETURNING id, display_name', [keepAccountId]);
    console.log(`[OK] Deleted ${accRes.rowCount} test accounts. Retained real Cloudflare account: "${keepAccountId}"`);

    // 7. Update real bucket used storage to match the real video size (15,448,322 bytes)
    await pool.query(
      `UPDATE storage_buckets 
       SET used_storage_bytes = 15448322, object_count = 2, updated_at = NOW() 
       WHERE bucket_name = $1`,
      [keepBucketName]
    );
    console.log(`[OK] Updated real bucket "${keepBucketName}" quota usage to 15.4 MB (1 video + 1 thumbnail).`);

    // 8. Clean storage alerts and reservations
    await pool.query('DELETE FROM storage_alerts');
    await pool.query('DELETE FROM storage_reservations');
    console.log('[OK] Reset storage_alerts and storage_reservations tables.');

    // 9. Verify current tables
    const remainingVideos = await pool.query('SELECT id, title, master_playlist_url FROM videos');
    console.log('\n--- REMAINING REAL VIDEOS ---');
    console.table(remainingVideos.rows);

    const remainingAccounts = await pool.query('SELECT id, display_name, account_id FROM storage_accounts');
    console.log('--- REMAINING REAL STORAGE ACCOUNTS ---');
    console.table(remainingAccounts.rows);

    const remainingBuckets = await pool.query('SELECT id, bucket_name, used_storage_bytes, logical_quota_bytes FROM storage_buckets');
    console.log('--- REMAINING REAL STORAGE BUCKETS ---');
    console.table(remainingBuckets.rows);

    console.log('\n=== ALL TEST DATA PERMANENTLY REMOVED! ===');
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanTestData();
