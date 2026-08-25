'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

function StatusBadge({ status }: { status: MockAccount['status'] }) {
  if (status === 'active') {
    return (
      <Badge variant="outline" className="border-verified text-verified">
        Connected
      </Badge>
    );
  }
  if (status === 'needs_reauth') {
    return (
      <Badge variant="outline" className="border-flag text-flag">
        Needs reauth
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-ink-muted text-ink-muted">
      Disconnected
    </Badge>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<MockAccount[]>(initialAccounts);
  const [pendingDisconnect, setPendingDisconnect] = useState<MockAccount | null>(null);

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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="font-mono text-xs text-ink-muted underline">
            ← Overhead
          </Link>
          <p className="mt-2 font-display text-2xl">Connected accounts</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>Connect an inbox</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                connect('google');
              }}
            >
              Google
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                connect('microsoft');
              }}
            >
              Microsoft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {needsReauth.map((account) => (
        <Alert key={account.id} className="border-flag">
          <AlertTitle className="text-flag">
            {providerLabel[account.provider]} connection expired
          </AlertTitle>
          <AlertDescription>Reconnect {account.emailAddress} to resume syncing.</AlertDescription>
        </Alert>
      ))}

      {accounts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            No inboxes connected yet. Detection works better with at least one — subscriptions you
            forgot about show up here.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last synced</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>{providerLabel[account.provider]}</TableCell>
                <TableCell className="font-mono text-sm">{account.emailAddress}</TableCell>
                <TableCell>
                  <StatusBadge status={account.status} />
                </TableCell>
                <TableCell className="font-mono text-sm text-ink-muted">
                  {account.lastSyncedAt ? formatDate(account.lastSyncedAt) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {account.status !== 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          reconnect(account.id);
                        }}
                      >
                        Reconnect
                      </Button>
                    )}
                    {account.status === 'disconnected' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          remove(account.id);
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-flag"
                        onClick={() => {
                          setPendingDisconnect(account);
                        }}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

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
