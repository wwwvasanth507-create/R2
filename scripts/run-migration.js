const { execSync } = require('child_process');
const path = require('path');

const psqlBin = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const schemaFile = path.resolve(__dirname, '../database/schema.sql');

try {
  console.log(`Applying schema from: ${schemaFile}...`);
  const out = execSync(`"${psqlBin}" -U postgres -h 127.0.0.1 -d media_platform -w -f "${schemaFile}"`, {
    env: { ...process.env, PGPASSWORD: '2008' }
  });
  console.log('SCHEMA MIGRATION SUCCESSFUL!');
  console.log(out.toString());

  // Verify created tables
  const tables = execSync(`"${psqlBin}" -U postgres -h 127.0.0.1 -d media_platform -w -c "\\dt"`, {
    env: { ...process.env, PGPASSWORD: '2008' }
  });
  console.log('CREATED TABLES IN media_platform:');
  console.log(tables.toString());
} catch (e) {
  console.error('Migration error:', e.message);
  process.exit(1);
}
