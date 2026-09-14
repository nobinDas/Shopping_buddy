'use client';

import { useState, useTransition } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/dates';
import type { DetectedSignalRow } from '@/server/db/queries/detection';
import { archiveSignalAction } from '@/app/(dashboard)/review/actions';

/**
 * One unified Pending/Resolved list mixing two sources, per explicit user
 * request to remove the earlier two-section layout:
 * - Real `detected_signals` rows with a Sonnet-written brief (the
 *   "unclear extraction" case, docs/DECISIONS.md ADR-018) — Go to email +
 *   Archive.
 * - Phase 1.5's mock proposal cards (no `reconciliation_proposals` table
 *   yet — Phase 1e, `docs/DATA_MODEL.md`) — Accept/Reject, plus a
 *   placeholder "Go to email" link. These 6 rows have no real linked
 *   email (mock data has never had one); `messageId` below is a made-up
 *   placeholder, not a real Gmail message — added on explicit request for
 *   visual consistency with the real cards, not because it resolves to
 *   anything.
 */
type ProposalType = 'confirm' | 'price_update' | 'date_update' | 'discovery' | 'cancellation';
type ProposalStatus = 'pending' | 'accepted' | 'rejected';

interface MockProposal {
  id: string;
  proposalType: ProposalType;
  vendorName: string;
  summary: string;
  reasoning: string;
  status: ProposalStatus;
  detectedAt: string;
  messageId: string;
}

const initialProposals: MockProposal[] = [
  {
    id: '1',
    proposalType: 'confirm',
    vendorName: 'Netflix',
    summary: 'Amount and billing date match the recorded subscription — no changes.',
    reasoning:
      'Extracted amount ($15.99) and billing date (5 Aug) matched the manual record exactly, within the 1% / 3-day match tolerance.',
    status: 'accepted',
    detectedAt: '2026-08-06',
    messageId: 'mock1a9f3c7e2b6d40',
  },
  {
    id: '2',
    proposalType: 'price_update',
    vendorName: 'Spotify Premium',
    summary: '$10.99 → $12.99',
    reasoning:
      'A renewal receipt on 12 Aug shows $12.99, 18% above the $10.99 currently recorded — outside the 1% match tolerance for a confirm.',
    status: 'pending',
    detectedAt: '2026-08-12',
    messageId: 'mock2b8e4d1a9c5f61',
  },
  {
    id: '3',
    proposalType: 'date_update',
    vendorName: 'Adobe Creative Cloud',
    summary: 'Billing date shifted from the 5th to the 8th',
    reasoning:
      'The last two renewal receipts landed on the 8th, four days outside the ±3-day tolerance around the recorded anchor date.',
    status: 'pending',
    detectedAt: '2026-08-08',
    messageId: 'mock3c7d5e2b8a4f92',
  },
  {
    id: '4',
    proposalType: 'discovery',
    vendorName: 'Apple.com/Bill',
    summary: '$4.99/mo — no matching manual record',
    reasoning:
      'A recurring charge from Apple.com/Bill appears monthly with no candidate scoring above 0.4 against any recorded subscription — likely an App Store subscription paid through a third party.',
    status: 'pending',
    detectedAt: '2026-08-14',
    messageId: 'mock4d6c8f3a1b7e03',
  },
  {
    id: '5',
    proposalType: 'cancellation',
    vendorName: 'HBO Max',
    summary: 'Cancellation confirmation received',
    reasoning:
      'An email with subject "Your HBO Max cancellation is confirmed" was classified as a cancellation signal and matched to this subscription by vendor and account.',
    status: 'pending',
    detectedAt: '2026-08-15',
    messageId: 'mock5e9b7a4c2d8f14',
  },
  {
    id: '6',
    proposalType: 'price_update',
    vendorName: 'Notion',
    summary: '$8.00 → $8.01',
    reasoning:
      'A receipt showed $8.01 against a recorded $8.00 — inside the 1% tolerance, but a currency-rounding artifact triggered a proposal rather than an automatic confirm; rejected as noise.',
    status: 'rejected',
    detectedAt: '2026-08-02',
    messageId: 'mock6f0a9d5b3e1c25',
  },
];

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

const acceptLabel: Record<ProposalType, string> = {
  confirm: 'Confirm',
  price_update: 'Accept new price',
  date_update: 'Accept new date',
  discovery: 'Add subscription',
  cancellation: 'Archive',
};

const acceptedDoneLabel: Record<ProposalType, string> = {
  confirm: 'CONFIRMED',
  price_update: 'PRICE UPDATED',
  date_update: 'DATE UPDATED',
  discovery: 'ADDED',
  cancellation: 'ARCHIVED',
};

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function gmailLink(messageId: string): string {
  // u/0 is hardcoded — email_accounts has no per-account "login slot" field
  // to compute it from. Fine for this single-account app. Mock cards' IDs
  // are placeholders and won't resolve to a real message.
  return `https://mail.google.com/mail/u/0/#all/${messageId}`;
}

interface CardView {
  id: string;
  badgeLabel: string;
  badgeTone: string;
  date: Date;
  vendorName: string;
  summaryLine?: string;
  description: string;
  messageId: string;
  resolved: boolean;
  resolvedLabel?: string;
  resolvedTone?: string;
  actions: { label: string; onClick: () => void; primary: boolean }[];
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
              {card.actions.map((action) => (
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
              ))}
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
}: {
  needsReviewPending: DetectedSignalRow[];
  needsReviewResolved: DetectedSignalRow[];
}) {
  const [proposals, setProposals] = useState<MockProposal[]>(initialProposals);
  const [, startTransition] = useTransition();

  function setStatus(id: string, status: ProposalStatus) {
    setProposals((current) => current.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  function archive(id: string) {
    startTransition(() => {
      void archiveSignalAction(id);
    });
  }

  const mockPending = proposals.filter((p) => p.status === 'pending');
  const mockResolved = proposals.filter((p) => p.status !== 'pending');

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
    ...mockPending.map(
      (proposal): CardView => ({
        id: proposal.id,
        badgeLabel: typeLabel[proposal.proposalType],
        badgeTone: typeToneClass[proposal.proposalType],
        date: new Date(proposal.detectedAt),
        vendorName: proposal.vendorName,
        summaryLine: proposal.summary,
        description: proposal.reasoning,
        messageId: proposal.messageId,
        resolved: false,
        actions: [
          {
            label: acceptLabel[proposal.proposalType],
            onClick: () => {
              setStatus(proposal.id, 'accepted');
            },
            primary: true,
          },
          {
            label: 'Reject',
            onClick: () => {
              setStatus(proposal.id, 'rejected');
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
    ...mockResolved.map(
      (proposal): CardView => ({
        id: proposal.id,
        badgeLabel: typeLabel[proposal.proposalType],
        badgeTone: typeToneClass[proposal.proposalType],
        date: new Date(proposal.detectedAt),
        summaryLine: proposal.summary,
        vendorName: proposal.vendorName,
        description: proposal.reasoning,
        messageId: proposal.messageId,
        resolved: true,
        resolvedLabel: proposal.status === 'rejected' ? 'REJECTED' : acceptedDoneLabel[proposal.proposalType],
        resolvedTone: proposal.status === 'rejected' ? 'text-ink-muted' : typeToneClass[proposal.proposalType],
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
