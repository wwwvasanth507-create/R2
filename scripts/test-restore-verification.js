const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const psqlBin = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const backupDir = path.resolve(__dirname, '../backups');
const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));

if (backupFiles.length === 0) {
  console.error('No backup files found!');
  process.exit(1);
}

const latestBackup = path.join(backupDir, backupFiles[0]);
console.log(`Found backup file: ${latestBackup}`);

function runPsql(db, cmd) {
  return execSync(`"${psqlBin}" -U postgres -h 127.0.0.1 -d ${db} -w -c "${cmd}"`, {
    env: { ...process.env, PGPASSWORD: '2008' },
    stdio: ['ignore', 'pipe', 'pipe']
  }).toString();
}

try {
  console.log('Creating test database media_platform_test_restore...');
  runPsql('postgres', 'DROP DATABASE IF EXISTS media_platform_test_restore;');
  runPsql('postgres', 'CREATE DATABASE media_platform_test_restore;');

  console.log('Restoring backup into media_platform_test_restore...');
  execSync(`"${psqlBin}" -U postgres -h 127.0.0.1 -d media_platform_test_restore -w -f "${latestBackup}"`, {
    env: { ...process.env, PGPASSWORD: '2008' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const countOut = runPsql('media_platform_test_restore', 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\';');
  console.log('TABLES RESTORED IN TEST DATABASE:');
  console.log(countOut);

  // Cleanup test database
  console.log('Cleaning up test database...');
  runPsql('postgres', 'DROP DATABASE media_platform_test_restore;');
  console.log('BACKUP AND RESTORE VERIFICATION: 100% SUCCESSFUL!');
} catch (err) {
  console.error('Restore verification error:', err.message);
  process.exit(1);
}
