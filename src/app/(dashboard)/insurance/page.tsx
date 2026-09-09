'use client';

import { useState } from 'react';
import Link from 'next/link';
import { differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatMoney, parseAmountToMinorUnits } from '@/lib/money';
import { formatDate } from '@/lib/dates';

/**
 * Phase 1.5 mock data — no dedicated insurance cost category exists yet
 * (that's Phase 2). Fields mirror what docs/PHASES.md's Phase 2 checklist
 * scopes: policy number, insurer, premium, term, renewal date, plus a
 * configurable reminder lead time.
 */
interface MockPolicy {
  id: string;
  type: 'medical' | 'auto';
  insurer: string;
  policyNumber: string;
  premiumMinor: number;
  currency: string;
  termMonths: number;
  renewalDate: string;
  reminderLeadDays: number;
}

const initialPolicies: MockPolicy[] = [
  {
    id: '1',
    type: 'auto',
    insurer: 'State Farm',
    policyNumber: 'AUTO-88213',
    premiumMinor: 84000,
    currency: 'USD',
    termMonths: 6,
    renewalDate: '2026-11-20',
    reminderLeadDays: 30,
  },
  {
    id: '2',
    type: 'medical',
    insurer: 'Blue Cross',
    policyNumber: 'MED-40217',
    premiumMinor: 312000,
    currency: 'USD',
    termMonths: 12,
    renewalDate: '2027-01-15',
    reminderLeadDays: 45,
  },
];

const typeLabel: Record<MockPolicy['type'], string> = {
  medical: 'Medical',
  auto: 'Auto',
};

function daysUntil(dateIso: string): number {
  return differenceInCalendarDays(new Date(dateIso), new Date());
}

/** `FormData.get` returns `FormDataEntryValue | null` — a text field is a
 * `string`, never a `File`, so this narrows without needing a cast. */
function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function PolicyForm({ onAdd }: { onAdd: (policy: MockPolicy) => void }) {
  const [type, setType] = useState<MockPolicy['type']>('auto');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const amountMinor = parseAmountToMinorUnits(getFormString(formData, 'premium'));
        if (amountMinor === null) return;

        onAdd({
          id: crypto.randomUUID(),
          type,
          insurer: getFormString(formData, 'insurer'),
          policyNumber: getFormString(formData, 'policyNumber'),
          premiumMinor: amountMinor,
          currency: 'USD',
          termMonths: type === 'auto' ? 6 : 12,
          renewalDate: getFormString(formData, 'renewalDate'),
          reminderLeadDays: Number(formData.get('reminderLeadDays') ?? 30),
        });
        event.currentTarget.reset();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value as MockPolicy['type']);
          }}
        >
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="medical">Medical</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="insurer">Insurer</Label>
        <Input id="insurer" name="insurer" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="policyNumber">Policy number</Label>
        <Input id="policyNumber" name="policyNumber" required className="font-mono" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="premium">Premium</Label>
        <Input
          id="premium"
          name="premium"
          required
          inputMode="decimal"
          placeholder="0.00"
          className="font-mono"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="renewalDate">Renewal date</Label>
        <Input id="renewalDate" name="renewalDate" type="date" required className="font-mono" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reminderLeadDays">Remind me (days before)</Label>
        <Input
          id="reminderLeadDays"
          name="reminderLeadDays"
          type="number"
          min={1}
          defaultValue={30}
          className="font-mono"
        />
      </div>
      <DialogFooter>
        <Button type="submit">Add policy</Button>
      </DialogFooter>
    </form>
  );
}

export default function InsurancePage() {
  const [policies, setPolicies] = useState<MockPolicy[]>(initialPolicies);
  const [open, setOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="font-display text-[28px] tracking-tight">Insurance</p>

      {policies.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            No policies tracked yet. Add the first one you know is due for renewal.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {policies.map((policy) => {
            const remaining = daysUntil(policy.renewalDate);
            const dueSoon = remaining <= policy.reminderLeadDays;
            return (
              <div key={policy.id} className="border border-rule p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="font-sans text-base font-medium text-ink">{policy.insurer}</span>
                  {dueSoon ? (
                    <span className="font-mono text-[10px] font-semibold tracking-widest text-pending">
                      RENEWS IN {remaining} DAYS
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] tracking-widest text-ink-muted">
                      {typeLabel[policy.type].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-y-3">
                  <div>
                    <p className="mb-1 font-mono text-[10px] text-ink-muted">PREMIUM</p>
                    <p className="font-mono text-xl text-ink">
                      {formatMoney({ amountMinor: policy.premiumMinor, currency: policy.currency })}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] text-ink-muted">TERM</p>
                    <p className="text-sm text-ink">{policy.termMonths} months</p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] text-ink-muted">POLICY</p>
                    <p className="font-mono text-[13px] text-ink">{policy.policyNumber}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] text-ink-muted">RENEWS</p>
                    <p className="font-mono text-[13px] text-ink">{formatDate(policy.renewalDate)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-ink-muted">
        Premiums fold into the dashboard&apos;s burn. This is a category view, not a separate
        ledger.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="h-12 w-full rounded-none bg-ink text-sm font-medium text-surface hover:bg-ink/90">
            Add a policy
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add insurance policy</DialogTitle>
          </DialogHeader>
          <PolicyForm
            onAdd={(policy) => {
              setPolicies((current) => [...current, policy]);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
