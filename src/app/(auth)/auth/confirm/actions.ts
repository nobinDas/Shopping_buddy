'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/server/providers/supabase';

// Bound with (tokenHash, type, next) from the page before being passed as a
// form action — React appends the FormData as the final argument on submit,
// which this doesn't need.
export async function confirmSignIn(tokenHash: string, type: string, next: string) {
  const supabase = await createClient();

  // EmailOtpType is 'signup' | 'invite' | ... | (string & {}) — a plain
  // string already satisfies it, so no cast needed here.
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    redirect('/login?error=invalid-link');
  }

  redirect(next);
}
