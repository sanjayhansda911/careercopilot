import { createBrowserClient } from '@supabase/ssr';
import { createMockSupabaseClient } from './mock-store';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url?.includes('dummy') || !url) {
    return createMockSupabaseClient() as any;
  }

  return createBrowserClient(url, anonKey || '');
}
