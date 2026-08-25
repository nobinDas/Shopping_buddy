import Link from 'next/link';

/**
 * Styled 404 for this route group — without this, Next.js falls back to
 * its unstyled default page. Reached via `notFound()` calls in
 * subscriptions/[id]/page.tsx and subscriptions/[id]/edit/page.tsx when an
 * id doesn't exist, or any unmatched route under (dashboard).
 */
export default function DashboardNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-display text-2xl">Overhead</p>
      <p className="text-base text-ink">This page doesn&apos;t exist, or the record was removed.</p>
      <Link href="/" className="font-mono text-sm underline">
        ← Back to Overhead
      </Link>
    </main>
  );
}
