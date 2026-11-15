const { execSync } = require('child_process');
const path = require('path');

const psqlBin = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const seedFile = path.resolve(__dirname, '../database/seed.sql');

try {
  console.log(`Applying seed from: ${seedFile}...`);
  const out = execSync(`"${psqlBin}" -U postgres -h 127.0.0.1 -d media_platform -w -f "${seedFile}"`, {
    env: { ...process.env, PGPASSWORD: '2008' }
  });
  console.log('SEED INSERTION SUCCESSFUL!');
  console.log(out.toString());

  // Count users
  const usersCount = execSync(`"${psqlBin}" -U postgres -h 127.0.0.1 -d media_platform -w -c "SELECT email, role, status FROM users;"`, {
    env: { ...process.env, PGPASSWORD: '2008' }
  });
  console.log('INITIAL USERS:');
  console.log(usersCount.toString());
} catch (e) {
  console.error('Seed error:', e.message);
  process.exit(1);
}
