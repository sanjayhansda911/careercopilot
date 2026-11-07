import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Connecting to live Supabase PostgreSQL database...');

  // Load from .env.local if present
  const envFile = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }

  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'fqvwguzrhlyvcadwbawu';

  if (!password) {
    throw new Error('SUPABASE_DB_PASSWORD is required in environment or .env.local');
  }

  // Try direct host first, or pooler if IPv6/IPv4 lookup
  const hostsToTry = [
    `db.${projectRef}.supabase.co`,
    `aws-0-ap-south-1.pooler.supabase.com`,
    `aws-0-us-east-1.pooler.supabase.com`,
    `aws-0-eu-central-1.pooler.supabase.com`
  ];

  let client: Client | null = null;
  let connectedHost = '';

  for (const host of hostsToTry) {
    const isPooler = host.includes('pooler');
    const user = isPooler ? `postgres.${projectRef}` : 'postgres';
    const port = isPooler ? 6543 : 5432;

    console.log(`Attempting connection to ${host}:${port} as ${user}...`);
    const c = new Client({
      host,
      port,
      user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    try {
      await c.connect();
      client = c;
      connectedHost = host;
      console.log(`✓ Successfully connected to PostgreSQL via ${host}!`);
      break;
    } catch (err: any) {
      console.warn(`Could not connect via ${host}: ${err.message}`);
      await c.end().catch(() => {});
    }
  }

  if (!client) {
    throw new Error('Failed to connect to Supabase PostgreSQL across all candidate endpoints.');
  }

  console.log('\nReading supabase/full_schema.sql...');
  const schemaPath = path.resolve(process.cwd(), 'supabase', 'full_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Applying database schema and RLS policies...');
  await client.query(schemaSql);
  console.log('✓ Full schema successfully executed!');

  // Verify created tables
  console.log('\nVerifying public tables:');
  const res = await client.query(`
    select table_name 
    from information_schema.tables 
    where table_schema = 'public' 
    order by table_name;
  `);

  const tables = res.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables in public schema:`, tables.join(', '));

  await client.end();
  console.log('\n🎉 Live Supabase Database Migration Completed Successfully!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
