'use client';

import { useState, useTransition, type SubmitEvent } from 'react';
import { requestMagicLink } from './actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestMagicLink(email);
      setStatus(result.error ? 'error' : 'sent');
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <p className="font-display text-2xl">Overhead</p>

      {status === 'sent' ? (
        <p className="font-mono text-sm text-verified">Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder="you@example.com"
            className="border border-rule bg-surface px-3 py-2 font-mono text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-ink px-3 py-2 font-mono text-sm text-surface disabled:opacity-60"
          >
            {isPending ? 'Sending…' : 'Send magic link'}
          </button>
          {status === 'error' && (
            <p className="font-mono text-sm text-flag">
              Could not send link. Check the email and try again.
            </p>
          )}
        </form>
      )}
    </main>
  );
}
