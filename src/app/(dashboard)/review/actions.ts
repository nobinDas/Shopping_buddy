'use server';

import { revalidatePath } from 'next/cache';
import { archiveSignal } from '@/server/db/queries/detection';

/**
 * The only action that moves a needs-review card from pending to resolved
 * (docs/DECISIONS.md ADR-018). "Go to email" is a plain link and never
 * calls this.
 */
export async function archiveSignalAction(id: string): Promise<void> {
  await archiveSignal(id);
  revalidatePath('/review');
}
