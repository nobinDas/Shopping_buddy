import { db, type DbClient } from '@/server/db';
import { getEmailAccountById, updateEmailAccountRow } from '@/server/db/queries/email-accounts';
import {
  insertDetectedSignal,
  getPendingSignalsForAccount,
  markSignalDuplicate,
} from '@/server/db/queries/detection';
import { getValidAccessToken } from '@/server/services/email-account.service';
import { listHistory, getMessageMetadata, getMessageBody } from '@/server/providers/gmail';
import {
  classifyEmail,
  writeReviewBrief,
  needsReviewBrief,
  type ClassificationResult,
  type ReviewBrief,
} from '@/server/providers/anthropic';
import { looksLikelySubscription } from '@/server/domain/prefilter';
import { computeContentHash } from '@/server/domain/content-hash';
import { dedupeSignals } from '@/server/domain/dedupe-signals';
import { normalizeVendorKey } from '@/server/domain/vendor-key';

export interface SyncResult {
  messagesScanned: number;
  signalsCreated: number;
  duplicatesMerged: number;
}

/**
 * Syncs one connected account: fetches new messages since its stored
 * cursor (or a bounded first-sync fallback), pre-filters cheaply on
 * metadata, classifies only the survivors, writes real detected_signals,
 * deduplicates the batch, and advances the cursor. On-demand only —
 * called from a "Sync now" click (accounts/actions.ts) or the cron route
 * (api/cron/sync), never automatically on every page load.
 *
 * Logs only safe fields throughout (docs/SECURITY.md: message IDs,
 * vendor keys, amounts, signal types, timing, error types — never
 * subject, snippet, or body) — this file is the one place all fetched
 * email content passes through server-side, so it's the deliberate choke
 * point for that rule.
 */
export async function syncAccount(accountId: string, client: DbClient = db): Promise<SyncResult> {
  const account = await getEmailAccountById(accountId, client);
  if (!account) {
    throw new Error(`syncAccount: no email account with id ${accountId}`);
  }

  const accessToken = await getValidAccessToken(account, client);
  const { messageIds, newHistoryId } = await listHistory(accessToken, account.syncCursor);

  let signalsCreated = 0;

  for (const messageId of messageIds) {
    const metadata = await getMessageMetadata(accessToken, messageId);
    if (!looksLikelySubscription(metadata)) {
      continue;
    }

    let classification: ClassificationResult | null;
    let reviewBrief: ReviewBrief | null = null;
    try {
      const { body, receivedAt } = await getMessageBody(accessToken, messageId);
      classification = await classifyEmail({
        subject: metadata.subject,
        from: metadata.from,
        body,
        receivedAt,
      });

      // Unclear extraction, or a signal type with no normal amount/date
      // shape to show (docs/DECISIONS.md ADR-018, extended by ADR-019).
      // Written here, still inside this try block, so it can reuse
      // `body` already fetched above — it's never persisted, so this is
      // the only place it's available without a second Gmail fetch.
      if (classification && needsReviewBrief(classification)) {
        try {
          reviewBrief = await writeReviewBrief({
            subject: metadata.subject,
            from: metadata.from,
            body,
          });
        } catch (error) {
          // A brief-generation failure doesn't sink the signal itself —
          // it still gets inserted below, just without a brief.
          console.error('syncAccount: review brief request failed', {
            messageId,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
          });
        }
      }
    } catch (error) {
      // A genuine request failure for one message doesn't abort the
      // whole sync — log the error type/message id only, move on.
      console.error('syncAccount: classification request failed', {
        messageId,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      continue;
    }

    if (!classification) {
      continue;
    }

    const contentHash = computeContentHash({
      sender: metadata.from,
      subject: metadata.subject,
      amountMinor: classification.amountMinor,
      billingDate: classification.billingDate,
    });

    const inserted = await insertDetectedSignal(
      {
        accountId,
        messageId,
        contentHash,
        signalType: classification.signalType,
        vendorKey: normalizeVendorKey(classification.vendorName),
        amountMinor: classification.amountMinor,
        currency: classification.currency,
        billingDate: classification.billingDate,
        confidence: classification.confidence.toString(),
        reviewBrief: reviewBrief?.summary ?? null,
        actionRequired: reviewBrief?.actionRequired ?? null,
      },
      client,
    );
    if (inserted) {
      signalsCreated += 1;
    }
  }

  const pending = await getPendingSignalsForAccount(accountId, client);
  const dedupeResult = dedupeSignals(
    pending.map((signal) => ({
      id: signal.id,
      contentHash: signal.contentHash,
      confidence: Number(signal.confidence),
      createdAt: signal.createdAt,
    })),
  );
  for (const { id, supersededBy } of dedupeResult.supersede) {
    await markSignalDuplicate(id, supersededBy, client);
  }

  await updateEmailAccountRow(
    accountId,
    { syncCursor: newHistoryId, lastSyncedAt: new Date() },
    client,
  );

  return {
    messagesScanned: messageIds.length,
    signalsCreated,
    duplicatesMerged: dedupeResult.supersede.length,
  };
}
