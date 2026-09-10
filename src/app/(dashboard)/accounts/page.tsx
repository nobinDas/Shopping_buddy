import Link from 'next/link';
import { getAllEmailAccounts } from '@/server/db/queries/email-accounts';
import { AccountsList } from '@/components/accounts/AccountsList';

const errorCopy: Record<string, string> = {
  denied: 'Connection was cancelled.',
  invalid_state: "That link had expired or wasn't from this app — try connecting again.",
  connect_failed: 'Something went wrong connecting that account — try again.',
};

interface AccountsPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const { error } = await searchParams;
  const accounts = await getAllEmailAccounts();

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="font-display text-[28px] tracking-tight">Accounts</p>

      {error && errorCopy[error] && (
        <p className="border border-flag px-3.5 py-3 text-[13px] text-flag">{errorCopy[error]}</p>
      )}

      <AccountsList accounts={accounts} />
    </main>
  );
}
