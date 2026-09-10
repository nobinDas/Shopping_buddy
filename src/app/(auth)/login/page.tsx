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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-7 pb-24">
      <p className="mb-2.5 font-display text-4xl leading-none tracking-tight">Overhead</p>
      <p className="mb-9 text-sm text-ink-muted">Recurring spending, made legible.</p>

      {status === 'sent' ? (
        <div>
          <p className="mb-1.5 text-[15px] text-verified">Check your email for a sign-in link.</p>
          <p className="text-[13px] text-ink-muted">Sent to {email}.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="oh-email" className="mb-2 block">
            <span className="mb-2 block font-mono text-[11px] tracking-wide text-ink-muted uppercase">
              Email
            </span>
            <input
              id="oh-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              className="h-12 w-full border border-control-border bg-surface px-3.5 text-base text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="h-12 w-full bg-ink font-sans text-[15px] font-medium text-surface disabled:opacity-60"
          >
            {isPending ? 'Sending…' : 'Send magic link'}
          </button>
          {status === 'error' ? (
            <p className="mt-1 text-sm text-flag">
              Could not send link. Check the email and try again.
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">
              No password. Sign-in links expire after 15 minutes.
            </p>
          )}
        </form>
      )}
    </main>
  );
}
