'use server';

import { revalidatePath } from 'next/cache';
import { getEmailAccountById } from '@/server/db/queries/email-accounts';
import { disconnectAccount } from '@/server/services/email-account.service';

export async function disconnectAccountAction(id: string): Promise<void> {
  const account = await getEmailAccountById(id);
  if (!account) {
    return;
  }
  await disconnectAccount(account);
  revalidatePath('/accounts');
}
