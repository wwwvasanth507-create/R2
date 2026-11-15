const { execSync } = require('child_process');

const psqlBin = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

function runSql(sql) {
  return execSync(`"${psqlBin}" -U postgres -h 127.0.0.1 -w -c "${sql}"`, {
    env: { ...process.env, PGPASSWORD: '2008' }
  }).toString();
}

try {
  console.log('=== LIST OF DATABASES ===');
  console.log(runSql('SELECT datname FROM pg_database WHERE datistemplate = false;'));

  // Check if media_platform exists
  const dbs = runSql('SELECT datname FROM pg_database WHERE datname = \'media_platform\';');
  if (!dbs.includes('media_platform')) {
    console.log('Creating database media_platform...');
    runSql('CREATE DATABASE media_platform;');
    console.log('Database media_platform created successfully!');
  } else {
    console.log('Database media_platform already exists!');
  }
} catch (err) {
  console.error('Error:', err.message);
}
