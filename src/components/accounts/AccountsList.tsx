'use client';

import { useState, useTransition } from 'react';
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
import type { EmailAccountSummary } from '@/server/db/queries/email-accounts';
import { disconnectAccountAction } from '@/app/(dashboard)/accounts/actions';

const providerLabel: Record<EmailAccountSummary['provider'], string> = {
  google: 'Google',
  microsoft: 'Microsoft',
};

const statusLabel: Record<EmailAccountSummary['status'], string> = {
  active: 'CONNECTED',
  needs_reauth: 'NEEDS REAUTH',
  disconnected: 'DISCONNECTED',
};

const statusTone: Record<EmailAccountSummary['status'], string> = {
  active: 'text-verified',
  needs_reauth: 'text-pending',
  disconnected: 'text-ink-muted',
};

export function AccountsList({ accounts }: { accounts: EmailAccountSummary[] }) {
  const [pendingDisconnect, setPendingDisconnect] = useState<EmailAccountSummary | null>(null);
  const [connectProvider, setConnectProvider] = useState<EmailAccountSummary['provider']>('google');
  const [isPending, startTransition] = useTransition();

  const needsReauth = accounts.filter((a) => a.status === 'needs_reauth');

  function confirmDisconnect() {
    if (!pendingDisconnect) return;
    const id = pendingDisconnect.id;
    setPendingDisconnect(null);
    startTransition(() => {
      void disconnectAccountAction(id);
    });
  }

  return (
    <>
      {needsReauth.map((account) => (
        <div key={account.id} className="bg-surface-2 px-3.5 py-3">
          <p className="mb-1 font-mono text-[11px] font-semibold tracking-wide text-pending uppercase">
            Needs reauth
          </p>
          <p className="mb-2.5 text-[13px] text-ink">
            {providerLabel[account.provider]} connection expired. Reconnect to resume syncing.
          </p>
          <a
            href="/api/auth/google/start"
            className="inline-block bg-ink px-4 py-2 font-sans text-[13px] font-medium text-surface"
          >
            Reconnect
          </a>
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
                  {account.lastSyncedAt
                    ? `LAST SYNC ${format(account.lastSyncedAt, 'd MMM yyyy')}`
                    : 'NOT SYNCED YET'}
                </p>
              </div>
              {account.status === 'needs_reauth' ? (
                <div className="flex flex-none gap-3 font-mono text-[11px]">
                  <a href="/api/auth/google/start" className="text-ink underline">
                    RECONNECT
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDisconnect(account);
                    }}
                    className="text-ink-muted underline"
                  >
                    DISCONNECT
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPendingDisconnect(account);
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
              setConnectProvider(value as EmailAccountSummary['provider']);
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
          {connectProvider === 'google' ? (
            <a
              href="/api/auth/google/start"
              className="flex flex-none items-center border border-control-border px-4 font-sans text-sm font-medium text-ink"
            >
              Connect
            </a>
          ) : (
            <span className="flex flex-none items-center border border-control-border px-4 font-sans text-sm font-medium text-ink-muted opacity-60">
              Coming soon
            </span>
          )}
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
              Overhead revokes access with the provider and removes the connection immediately.
              Subscriptions already confirmed from it stay as they are — nothing already recorded
              is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={confirmDisconnect}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
