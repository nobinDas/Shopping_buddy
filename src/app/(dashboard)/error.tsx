'use client';

import { Button } from '@/components/ui/button';

/**
 * Next.js route-segment error boundary — catches a thrown error anywhere
 * in this group's Server or Client Components (e.g. a Supabase query
 * failing) and renders this instead of a blank page. Never renders
 * `error.message`: it can carry internal detail (a connection string, a
 * query fragment) that CLAUDE.md's security rules don't want surfaced to
 * the browser. Copy follows DESIGN.md: "state the problem and the fix,
 * without apologising."
 */
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-display text-2xl">Overhead</p>
      <p className="text-base text-ink">
        Something went wrong loading this page. Your data is untouched.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
