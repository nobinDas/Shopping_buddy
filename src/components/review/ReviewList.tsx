'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { DetectedSignalRow } from '@/server/db/queries/detection';
import type { ProposalView } from '@/server/db/queries/reconciliation';
import { archiveSignalAction, acceptProposalAction, rejectProposalAction } from '@/app/(dashboard)/review/actions';

/**
 * One unified Pending/Resolved list mixing two real sources — Phase 1e
 * replaced the mock `reconciliation_proposals` fixture data this page
 * originally shipped with (Phase 1.5) with the real thing, docs/DATA_MODEL.md:
 * - `detected_signals` rows with a Sonnet-written brief (the "unclear
 *   extraction" case, docs/DECISIONS.md ADR-018) — Go to email + Archive.
 * - Real `reconciliation_proposals` rows from `domain/reconcile.ts` —
 *   Accept/Reject for price_update/date_update/cancellation, an "Add
 *   subscription" link for discovery (docs/DECISIONS.md ADR-020), and no
 *   actions at all for confirm (already auto-applied by the time it's
 *   ever seen — see `services/reconciliation.service.ts`).
 */
type ProposalType = ProposalView['proposalType'];

const typeLabel: Record<ProposalType, string> = {
  confirm: 'CONFIRM',
  price_update: 'PRICE UPDATE',
  date_update: 'DATE UPDATE',
  discovery: 'DISCOVERY',
  cancellation: 'CANCELLATION',
};

// See docs/DESIGN.md's three signal colours: flag = action needed,
// verified = confirmed against email, pending = detected, awaiting review.
const typeToneClass: Record<ProposalType, string> = {
  confirm: 'text-verified',
  price_update: 'text-flag',
  date_update: 'text-flag',
  discovery: 'text-pending',
  cancellation: 'text-pending',
};

const resolvedLabel: Record<ProposalType, string> = {
  confirm: 'CONFIRMED',
  price_update: 'PRICE UPDATED',
  date_update: 'DATE UPDATED',
  discovery: 'ADDED',
  cancellation: 'CANCELLED',
};

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function gmailLink(messageId: string): string {
  // u/0 is hardcoded — email_accounts has no per-account "login slot" field
  // to compute it from. Fine for this single-account app.
  return `https://mail.google.com/mail/u/0/#all/${messageId}`;
}

/**
 * A pending proposal's "old → new" summary line — only meaningful before
 * acceptance, since the live subscription snapshot on `ProposalView`
 * reflects the record *at read time*, which for an already-accepted
 * proposal is the new value, not the old one it changed from. Resolved
 * cards fall back to `reasoning` instead, which already states both
 * values verbatim (see `domain/reconcile.ts`'s outcome messages).
 */
function pendingSummaryLine(proposal: ProposalView): string | undefined {
  const changes = proposal.proposedChanges as Record<string, unknown>;
  switch (proposal.proposalType) {
    case 'price_update': {
      const from =
        proposal.subscriptionAmountMinor != null && proposal.subscriptionCurrency
          ? formatMoney({
              amountMinor: proposal.subscriptionAmountMinor,
              currency: proposal.subscriptionCurrency,
            })
          : '—';
      const to = formatMoney({
        amountMinor: changes['amountMinor'] as number,
        currency: changes['currency'] as string,
      });
      return `${from} → ${to}`;
    }
    case 'date_update': {
      const from = proposal.subscriptionNextBillingDate
        ? formatDate(proposal.subscriptionNextBillingDate)
        : '—';
      const to = formatDate(changes['billingDate'] as string);
      return `${from} → ${to}`;
    }
    case 'discovery': {
      const amountMinor = changes['amountMinor'] as number | null;
      const currency = changes['currency'] as string | null;
      return amountMinor != null && currency
        ? `${formatMoney({ amountMinor, currency })} — no matching manual record`
        : 'No matching manual record';
    }
    case 'cancellation':
      return 'Cancellation confirmation received';
    case 'confirm':
      return undefined;
  }
}

interface CardView {
  id: string;
  badgeLabel: string;
  badgeTone: string;
  date: Date;
  vendorName: string;
  summaryLine?: string | undefined;
  description: string;
  messageId: string;
  resolved: boolean;
  resolvedLabel?: string;
  resolvedTone?: string;
  actions: { label: string; onClick?: () => void; href?: string; primary: boolean }[];
}

function ReviewCard({ card }: { card: CardView }) {
  return (
    <div className="border-b border-rule py-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className={`font-mono text-[10px] font-semibold tracking-widest ${card.badgeTone}`}>
          {card.badgeLabel}
        </span>
        <span className="font-mono text-[10px] text-ink-muted">{formatDate(card.date.toISOString())}</span>
      </div>
      <p className="mb-1.5 font-sans text-base font-medium text-ink">{card.vendorName}</p>
      {card.summaryLine && <p className="mb-3 font-mono text-sm text-ink">{card.summaryLine}</p>}
      <p className="mb-3 text-[13px] leading-relaxed text-ink-muted">{card.description}</p>

      {card.resolved ? (
        <>
          <p className={`mb-3 font-mono text-xs tracking-wide ${card.resolvedTone ?? 'text-ink-muted'}`}>
            {card.resolvedLabel}
          </p>
          <a
            href={gmailLink(card.messageId)}
            target="_blank"
            rel="noopener"
            className="block w-full border border-control-border py-2.5 text-center font-sans text-sm font-medium text-ink"
          >
            Go to email
          </a>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {card.actions.length > 0 && (
            <div className="flex gap-2">
              {card.actions.map((action) =>
                action.href ? (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={
                      action.primary
                        ? 'flex-1 bg-ink py-2.5 text-center font-sans text-sm font-medium text-surface'
                        : 'flex-1 border border-control-border py-2.5 text-center font-sans text-sm font-medium text-ink'
                    }
                  >
                    {action.label}
                  </Link>
                ) : (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className={
                      action.primary
                        ? 'flex-1 bg-ink py-2.5 font-sans text-sm font-medium text-surface'
                        : 'flex-1 border border-control-border py-2.5 font-sans text-sm font-medium text-ink'
                    }
                  >
                    {action.label}
                  </button>
                ),
              )}
            </div>
          )}
          <a
            href={gmailLink(card.messageId)}
            target="_blank"
            rel="noopener"
            className="block w-full border border-control-border py-2.5 text-center font-sans text-sm font-medium text-ink"
          >
            Go to email
          </a>
        </div>
      )}
    </div>
  );
}

export function ReviewList({
  needsReviewPending,
  needsReviewResolved,
  pendingProposals,
  resolvedProposals,
}: {
  needsReviewPending: DetectedSignalRow[];
  needsReviewResolved: DetectedSignalRow[];
  pendingProposals: ProposalView[];
  resolvedProposals: ProposalView[];
}) {
  const [, startTransition] = useTransition();

  function archive(id: string) {
    startTransition(() => {
      void archiveSignalAction(id);
    });
  }

  function accept(id: string) {
    startTransition(() => {
      void acceptProposalAction(id);
    });
  }

  function reject(id: string) {
    startTransition(() => {
      void rejectProposalAction(id);
    });
  }

  const pendingCards: CardView[] = [
    ...needsReviewPending.map(
      (signal): CardView => ({
        id: signal.id,
        badgeLabel: signal.actionRequired ? 'ACTION MAY BE NEEDED' : 'NO ACTION NEEDED',
        badgeTone: signal.actionRequired ? 'text-flag' : 'text-ink-muted',
        date: signal.createdAt,
        vendorName: titleCase(signal.vendorKey),
        description: signal.reviewBrief ?? '',
        messageId: signal.messageId,
        resolved: false,
        actions: [
          {
            label: 'Archive',
            onClick: () => {
              archive(signal.id);
            },
            primary: true,
          },
        ],
      }),
    ),
    ...pendingProposals.map(
      (proposal): CardView => ({
        id: proposal.id,
        badgeLabel: typeLabel[proposal.proposalType],
        badgeTone: typeToneClass[proposal.proposalType],
        date: proposal.createdAt,
        vendorName: proposal.subscriptionName ?? titleCase(proposal.vendorKey),
        summaryLine: pendingSummaryLine(proposal),
        description: proposal.reasoning,
        messageId: proposal.messageId,
        resolved: false,
        actions:
          proposal.proposalType === 'discovery'
            ? [
                {
                  label: 'Add subscription',
                  href: `/subscriptions/new?proposalId=${proposal.id}`,
                  primary: true,
                },
                {
                  label: 'Reject',
                  onClick: () => {
                    reject(proposal.id);
                  },
                  primary: false,
                },
              ]
            : [
                {
                  label:
                    proposal.proposalType === 'cancellation'
                      ? 'Confirm cancellation'
                      : proposal.proposalType === 'price_update'
                        ? 'Accept new price'
                        : 'Accept new date',
                  onClick: () => {
                    accept(proposal.id);
                  },
                  primary: true,
                },
                {
                  label: 'Reject',
                  onClick: () => {
                    reject(proposal.id);
                  },
                  primary: false,
                },
              ],
      }),
    ),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const resolvedCards: CardView[] = [
    ...needsReviewResolved.map(
      (signal): CardView => ({
        id: signal.id,
        badgeLabel: signal.actionRequired ? 'ACTION MAY BE NEEDED' : 'NO ACTION NEEDED',
        badgeTone: signal.actionRequired ? 'text-flag' : 'text-ink-muted',
        date: signal.resolvedAt ?? signal.createdAt,
        vendorName: titleCase(signal.vendorKey),
        description: signal.reviewBrief ?? '',
        messageId: signal.messageId,
        resolved: true,
        resolvedLabel: 'ARCHIVED',
        resolvedTone: 'text-ink-muted',
        actions: [],
      }),
    ),
    ...resolvedProposals.map(
      (proposal): CardView => ({
        id: proposal.id,
        badgeLabel: typeLabel[proposal.proposalType],
        badgeTone: typeToneClass[proposal.proposalType],
        date: proposal.resolvedAt ?? proposal.createdAt,
        vendorName: proposal.subscriptionName ?? titleCase(proposal.vendorKey),
        description: proposal.reasoning,
        messageId: proposal.messageId,
        resolved: true,
        resolvedLabel: proposal.status === 'rejected' ? 'REJECTED' : resolvedLabel[proposal.proposalType],
        resolvedTone:
          proposal.status === 'rejected' ? 'text-ink-muted' : typeToneClass[proposal.proposalType],
        actions: [],
      }),
    ),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Pending {pendingCards.length}</TabsTrigger>
        <TabsTrigger value="resolved">Resolved {resolvedCards.length}</TabsTrigger>
      </TabsList>

      <TabsContent value="pending">
        {pendingCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
            <p className="text-base text-ink">Nothing waiting on you. Detection runs daily.</p>
          </div>
        ) : (
          pendingCards.map((card) => <ReviewCard key={card.id} card={card} />)
        )}
      </TabsContent>

      <TabsContent value="resolved">
        {resolvedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
            <p className="text-base text-ink">Nothing resolved yet.</p>
          </div>
        ) : (
          resolvedCards.map((card) => <ReviewCard key={card.id} card={card} />)
        )}
      </TabsContent>
    </Tabs>
  );
}
