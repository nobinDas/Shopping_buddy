import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { createClient } from '@/server/providers/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  // EmailOtpType is 'signup' | 'invite' | ... | (string & {}) — a plain
  // string already satisfies it, so casting here would be a no-op assertion.
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/';

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      redirect(next);
    }
  }

  redirect('/login?error=invalid-link');
}
