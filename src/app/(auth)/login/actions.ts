'use server';

import { createClient } from '@/server/providers/supabase';

export interface MagicLinkResult {
  error: string | null;
}

export async function requestMagicLink(email: string): Promise<MagicLinkResult> {
  const supabase = await createClient();
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Single-user app — only the account created directly in the Supabase
      // dashboard may sign in. Without this, signInWithOtp silently creates
      // a new account for any email address that asks for a link.
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error) {
    return { error: 'Could not send a sign-in link. Check the email and try again.' };
  }

  return { error: null };
}
