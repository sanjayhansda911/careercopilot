import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { createMockSupabaseClient } from './mock-store';

/**
 * Creates an authenticated Supabase server client that respects Row Level Security (RLS)
 * by extracting and updating cookies from the incoming Next.js request.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url?.includes('dummy') || !url) {
    return createMockSupabaseClient() as any;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey || '', {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: unknown }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        } catch {
          // Can be ignored if called from a Server Component and middleware is in place
        }
      },
    },
  });
}

/**
 * Admin client using SUPABASE_SERVICE_ROLE_KEY.
 * STRICTLY for trusted background workers, scheduled cron jobs, and initial bootstrap.
 * Bypasses RLS. NEVER expose to client.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url?.includes('dummy') || !url) {
    return createMockSupabaseClient() as any;
  }

  if (!key) {
    throw new Error('Supabase server environment variable SUPABASE_SERVICE_ROLE_KEY is missing.');
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
