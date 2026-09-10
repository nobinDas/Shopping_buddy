'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/dates';

/**
 * Phase 1.5 mock data — no reconciliation_proposals table exists yet
 * (that's Phase 1e, "the crux of the phase," see docs/DATA_MODEL.md). Shape
 * mirrors that table. `reasoning` is required on every row here on purpose
 * — see docs/CLAUDE.md: "Every automated financial suggestion writes a
 * reasoning record. No silent recommendations."
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

function ProposalCard({
  proposal,
  onAccept,
  onReject,
}: {
  proposal: MockProposal;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const rejected = proposal.status === 'rejected';

  return (
    <div className="border-b border-rule py-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span
          className={`font-mono text-[10px] font-semibold tracking-widest ${typeToneClass[proposal.proposalType]}`}
        >
          {typeLabel[proposal.proposalType]}
        </span>
        <span className="font-mono text-[10px] text-ink-muted">
          {formatDate(proposal.detectedAt)}
        </span>
      </div>
      <p className="mb-1.5 font-sans text-base font-medium text-ink">{proposal.vendorName}</p>
      <p className="mb-3 font-mono text-sm text-ink">{proposal.summary}</p>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-muted">{proposal.reasoning}</p>

      {proposal.status === 'pending' ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onAccept(proposal.id);
            }}
            className="flex-1 bg-ink py-2.5 font-sans text-sm font-medium text-surface"
          >
            {acceptLabel[proposal.proposalType]}
          </button>
          <button
            type="button"
            onClick={() => {
              onReject(proposal.id);
            }}
            className="flex-1 border border-control-border py-2.5 font-sans text-sm font-medium text-ink"
          >
            Reject
          </button>
        </div>
      ) : (
        <p
          className={`font-mono text-xs tracking-wide ${rejected ? 'text-ink-muted' : typeToneClass[proposal.proposalType]}`}
        >
          {rejected ? 'REJECTED' : acceptedDoneLabel[proposal.proposalType]}
        </p>
      )}
    </div>
  );
}

export default function ReviewQueuePage() {
  const [proposals, setProposals] = useState<MockProposal[]>(initialProposals);

  const pending = proposals.filter((p) => p.status === 'pending');
  const resolved = proposals.filter((p) => p.status !== 'pending');

  function setStatus(id: string, status: ProposalStatus) {
    setProposals((current) => current.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <p className="font-display text-[28px] tracking-tight">Review</p>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending {pending.length}</TabsTrigger>
          <TabsTrigger value="resolved">Resolved {resolved.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
              <p className="text-base text-ink">Nothing waiting on you. Detection runs daily.</p>
            </div>
          ) : (
            pending.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onAccept={(id) => {
                  setStatus(id, 'accepted');
                }}
                onReject={(id) => {
                  setStatus(id, 'rejected');
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved">
          {resolved.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
              <p className="text-base text-ink">Nothing resolved yet.</p>
            </div>
          ) : (
            resolved.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onAccept={(id) => {
                  setStatus(id, 'accepted');
                }}
                onReject={(id) => {
                  setStatus(id, 'rejected');
                }}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
