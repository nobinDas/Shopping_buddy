'use server';

import { revalidatePath } from 'next/cache';
import { archiveSignal } from '@/server/db/queries/detection';
import { acceptProposal, rejectProposal } from '@/server/services/reconciliation.service';

/**
 * The only action that moves a needs-review card from pending to resolved
 * (docs/DECISIONS.md ADR-018). "Go to email" is a plain link and never
 * calls this.
 */
export async function archiveSignalAction(id: string): Promise<void> {
  await archiveSignal(id);
  revalidatePath('/review');
}

/**
 * Accepts a `price_update`, `date_update`, or `cancellation` proposal —
 * see `services/reconciliation.service.ts#acceptProposal` for why
 * `discovery` isn't handled here (it routes through "Add subscription"
 * instead, docs/DECISIONS.md ADR-020).
 */
export async function acceptProposalAction(id: string): Promise<void> {
  await acceptProposal(id);
  revalidatePath('/review');
  revalidatePath('/subscriptions');
  revalidatePath('/');
}

/** Rejects any pending proposal, discovery included. */
export async function rejectProposalAction(id: string): Promise<void> {
  await rejectProposal(id);
  revalidatePath('/review');
}
