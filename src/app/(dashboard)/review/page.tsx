'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  confirm: 'Confirmed',
  price_update: 'Price change',
  date_update: 'Date change',
  discovery: 'Discovery',
  cancellation: 'Cancellation',
};

// See docs/DESIGN.md's three signal colours: flag = action needed,
// verified = confirmed against email, pending = detected, awaiting review.
const typeBadgeClass: Record<ProposalType, string> = {
  confirm: 'border-verified text-verified',
  price_update: 'border-flag text-flag',
  date_update: 'border-pending text-pending',
  discovery: 'border-pending text-pending',
  cancellation: 'border-flag text-flag',
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
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-display text-lg font-normal">
              {proposal.vendorName}
            </CardTitle>
            <p className="mt-1 font-mono text-sm text-ink">{proposal.summary}</p>
          </div>
          <Badge variant="outline" className={typeBadgeClass[proposal.proposalType]}>
            {typeLabel[proposal.proposalType]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{proposal.reasoning}</p>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs text-ink-muted">
            Detected {formatDate(proposal.detectedAt)}
          </p>
          {proposal.status === 'pending' ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onReject(proposal.id);
                }}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onAccept(proposal.id);
                }}
              >
                Accept
              </Button>
            </div>
          ) : (
            <p className="font-mono text-xs text-ink-muted uppercase">
              {proposal.status === 'accepted' ? 'Accepted' : 'Rejected'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header>
        <Link href="/" className="font-mono text-xs text-ink-muted underline">
          ← Overhead
        </Link>
        <p className="mt-2 font-display text-2xl">Review queue</p>
      </header>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 flex flex-col gap-4">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded border border-rule bg-surface-2 p-12 text-center">
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

        <TabsContent value="resolved" className="mt-4 flex flex-col gap-4">
          {resolved.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded border border-rule bg-surface-2 p-12 text-center">
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
