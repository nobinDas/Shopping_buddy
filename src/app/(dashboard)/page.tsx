import { createClient } from '@/server/providers/supabase';
import { signOut } from './actions';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <p className="font-display text-2xl">Overhead</p>
      <p className="font-mono text-sm text-ink-muted">
        Phase 0 skeleton — the burn overview lands in Phase 1b.
      </p>
      <p className="font-mono text-sm text-ink-muted">Signed in as {user?.email}</p>
      <form action={signOut}>
        <button type="submit" className="font-mono text-sm text-flag underline">
          Sign out
        </button>
      </form>
    </main>
  );
}
