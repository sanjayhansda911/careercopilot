import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function main() {
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fqvwguzrhlyvcadwbawu.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !anonKey) {
    throw new Error('Supabase keys missing from environment.');
  }

  console.log('Testing Supabase Admin Client with Secret Key...');
  const adminClient = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: jobs, error: jobErr } = await adminClient.from('jobs').select('count');
  if (jobErr) {
    console.error('Admin query error:', jobErr);
  } else {
    console.log('✓ Admin client query successful! Job count:', jobs);
  }

  console.log('\nTesting Supabase Public Client with Anon Key...');
  const publicClient = createClient(url, anonKey);
  const { data: publicJobs, error: publicErr } = await publicClient.from('jobs').select('count');
  if (publicErr) {
    console.log('Public query response:', publicErr.message);
  } else {
    console.log('✓ Public client query successful! Jobs:', publicJobs);
  }
}

main().catch(console.error);
