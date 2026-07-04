const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { Client } = require('pg');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getDatabaseName(connectionString) {
  const parsed = new URL(connectionString);
  return parsed.pathname.replace(/^\//, '');
}

function buildAdminConnectionString(connectionString) {
  const parsed = new URL(connectionString);
  const maintenanceDb = process.env.PG_ADMIN_DB || 'postgres';
  parsed.pathname = `/${maintenanceDb}`;
  return parsed.toString();
}

async function createDatabaseIfMissing(connectionString) {
  const databaseName = getDatabaseName(connectionString);
  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name');
  }

  const adminClient = new Client({ connectionString: buildAdminConnectionString(connectionString) });
  await adminClient.connect();
  try {
    const existsResult = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1', [databaseName]);
    if (!existsResult.rowCount) {
      await adminClient.query(`CREATE DATABASE \"${databaseName}\"`);
      console.log(`Created database: ${databaseName}`);
    } else {
      console.log(`Database already exists: ${databaseName}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function runSqlFiles(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const schemaPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'tables.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log(`Applied schema: ${schemaPath}`);

    const migrationsDir = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log(`Applied migration: ${file}`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL');
  await createDatabaseIfMissing(databaseUrl);
  await runSqlFiles(databaseUrl);
  console.log('Database bootstrap complete.');
}

main().catch((error) => {
  console.error('Database bootstrap failed:', error.message);
  process.exit(1);
});
