'use server';

import { revalidatePath } from 'next/cache';
import { getEmailAccountById } from '@/server/db/queries/email-accounts';
import { disconnectAccount } from '@/server/services/email-account.service';
import { syncAccount, type SyncResult } from '@/server/services/detection.service';

export async function disconnectAccountAction(id: string): Promise<void> {
  const account = await getEmailAccountById(id);
  if (!account) {
    return;
  }
  await disconnectAccount(account);
  revalidatePath('/accounts');
}

export type SyncAccountActionResult = { status: 'ok'; result: SyncResult } | { status: 'error'; message: string };

/**
 * On-demand only — no automatic sync on page load or a schedule. See
 * services/detection.service.ts#syncAccount.
 */
export async function syncAccountAction(id: string): Promise<SyncAccountActionResult> {
  try {
    const result = await syncAccount(id);
    revalidatePath('/accounts');
    return { status: 'ok', result };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Sync failed.' };
  }
}
