import { confirmSignIn } from './actions';

interface ConfirmPageProps {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const params = await searchParams;
  const tokenHash = params.token_hash;
  const type = params.type;
  const next = params.next ?? '/';

  if (!tokenHash || !type) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="font-display text-2xl">Overhead</p>
        <p className="font-mono text-sm text-flag">This sign-in link is invalid or has expired.</p>
      </main>
    );
  }

  const confirm = confirmSignIn.bind(null, tokenHash, type, next);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <p className="font-display text-2xl">Overhead</p>
      <p className="font-mono text-sm text-ink-muted">Click below to finish signing in.</p>
      <form action={confirm}>
        <button type="submit" className="bg-ink px-4 py-2 font-mono text-sm text-surface">
          Sign in
        </button>
      </form>
    </main>
  );
}
