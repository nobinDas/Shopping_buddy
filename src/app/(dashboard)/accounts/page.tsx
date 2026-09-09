'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDate } from '@/lib/dates';

/**
 * Phase 1.5 mock data — no email_accounts table exists yet (that's Phase
 * 1c). Shape mirrors docs/DATA_MODEL.md's `email_accounts` so this screen
 * only needs its data source swapped for a real query once 1c is built,
 * not its layout.
 */
interface MockAccount {
  id: string;
  provider: 'google' | 'microsoft';
  emailAddress: string;
  status: 'active' | 'needs_reauth' | 'disconnected';
  lastSyncedAt: string | null;
}

const initialAccounts: MockAccount[] = [
  {
    id: '1',
    provider: 'google',
    emailAddress: 'nirjhar212@gmail.com',
    status: 'active',
    lastSyncedAt: '2026-08-25',
  },
  {
    id: '2',
    provider: 'microsoft',
    emailAddress: 'nirjhar@outlook.com',
    status: 'needs_reauth',
    lastSyncedAt: '2026-08-10',
  },
];

const providerLabel: Record<MockAccount['provider'], string> = {
  google: 'Google',
  microsoft: 'Microsoft',
};

const statusLabel: Record<MockAccount['status'], string> = {
  active: 'CONNECTED',
  needs_reauth: 'NEEDS REAUTH',
  disconnected: 'DISCONNECTED',
};

const statusTone: Record<MockAccount['status'], string> = {
  active: 'text-verified',
  needs_reauth: 'text-pending',
  disconnected: 'text-ink-muted',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<MockAccount[]>(initialAccounts);
  const [pendingDisconnect, setPendingDisconnect] = useState<MockAccount | null>(null);
  const [connectProvider, setConnectProvider] = useState<MockAccount['provider']>('google');

  const needsReauth = accounts.filter((a) => a.status === 'needs_reauth');

  function connect(provider: MockAccount['provider']) {
    const placeholderEmail = provider === 'google' ? 'you@gmail.com' : 'you@outlook.com';
    setAccounts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        provider,
        emailAddress: placeholderEmail,
        status: 'active',
        lastSyncedAt: null,
      },
    ]);
  }

  function reconnect(id: string) {
    setAccounts((current) =>
      current.map((a) =>
        a.id === id
          ? { ...a, status: 'active', lastSyncedAt: format(new Date(), 'yyyy-MM-dd') }
          : a,
      ),
    );
  }

  function confirmDisconnect() {
    if (!pendingDisconnect) return;
    setAccounts((current) =>
      current.map((a) => (a.id === pendingDisconnect.id ? { ...a, status: 'disconnected' } : a)),
    );
    setPendingDisconnect(null);
  }

  function remove(id: string) {
    setAccounts((current) => current.filter((a) => a.id !== id));
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="font-display text-[28px] tracking-tight">Accounts</p>

      {needsReauth.map((account) => (
        <div key={account.id} className="bg-surface-2 px-3.5 py-3">
          <p className="mb-1 font-mono text-[11px] font-semibold tracking-wide text-pending uppercase">
            Needs reauth
          </p>
          <p className="mb-2.5 text-[13px] text-ink">
            {providerLabel[account.provider]} connection expired. Reconnect to resume syncing.
          </p>
          <button
            type="button"
            onClick={() => {
              reconnect(account.id);
            }}
            className="bg-ink px-4 py-2 font-sans text-[13px] font-medium text-surface"
          >
            Reconnect
          </button>
        </div>
      ))}

      {accounts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            No inboxes connected yet. Detection works better with at least one — subscriptions you
            forgot about show up here.
          </p>
        </div>
      ) : (
        <div className="border-t border-rule">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-start justify-between gap-3 border-b border-rule py-3.5"
            >
              <div>
                <p className="mb-1 font-sans text-[15px] font-medium text-ink">
                  {account.emailAddress}
                </p>
                <p className="font-mono text-[11px] text-ink-muted uppercase">
                  {providerLabel[account.provider]} ·{' '}
                  {account.status === 'disconnected'
                    ? `DISCONNECTED${account.lastSyncedAt ? ` ${formatDate(account.lastSyncedAt)}` : ''}`
                    : `LAST SYNC ${account.lastSyncedAt ? formatDate(account.lastSyncedAt) : '—'}`}
                </p>
              </div>
              {account.status === 'disconnected' ? (
                <div className="flex flex-none gap-3 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      reconnect(account.id);
                    }}
                    className="text-ink underline"
                  >
                    RECONNECT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove(account.id);
                    }}
                    className="text-ink-muted underline"
                  >
                    REMOVE
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (account.status === 'needs_reauth') {
                      reconnect(account.id);
                    } else {
                      setPendingDisconnect(account);
                    }
                  }}
                  className={`flex-none font-mono text-[10px] tracking-wide ${statusTone[account.status]}`}
                >
                  {statusLabel[account.status]}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1.5 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
          Connect an inbox
        </p>
        <div className="flex gap-2.5">
          <Select
            value={connectProvider}
            onValueChange={(value) => {
              setConnectProvider(value as MockAccount['provider']);
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="microsoft">Microsoft</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => {
              connect(connectProvider);
            }}
            className="flex-none border border-control-border px-4 font-sans text-sm font-medium text-ink"
          >
            Connect
          </button>
        </div>
      </div>

      <AlertDialog
        open={pendingDisconnect !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisconnect(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {pendingDisconnect?.emailAddress}?</AlertDialogTitle>
            <AlertDialogDescription>
              Overhead stops reading this inbox immediately. Subscriptions already confirmed from it
              stay as they are — nothing already recorded is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
