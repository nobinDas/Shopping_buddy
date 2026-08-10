import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Checked inside the function, not at module scope — narrowing an outer
  // const doesn't survive into a nested function body, since TS can't rule
  // out reassignment between module load and the function actually running.
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
