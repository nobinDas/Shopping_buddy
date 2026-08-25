'use client';

import { useState } from 'react';
import Link from 'next/link';
import { differenceInCalendarDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="font-mono text-xs text-ink-muted underline">
            ← Overhead
          </Link>
          <p className="mt-2 font-display text-2xl">Insurance</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add policy</Button>
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
      </header>

      {policies.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            No policies tracked yet. Add the first one you know is due for renewal.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {policies.map((policy) => {
            const remaining = daysUntil(policy.renewalDate);
            const dueSoon = remaining <= policy.reminderLeadDays;
            return (
              <Card key={policy.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-display text-lg font-normal">
                        {policy.insurer}
                      </CardTitle>
                      <p className="mt-1 font-mono text-xs text-ink-muted">{policy.policyNumber}</p>
                    </div>
                    <Badge variant="outline">{typeLabel[policy.type]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xl text-ink">
                        {formatMoney({
                          amountMinor: policy.premiumMinor,
                          currency: policy.currency,
                        })}
                        <span className="ml-1 text-sm text-ink-muted">
                          / {policy.termMonths} mo
                        </span>
                      </p>
                      <p
                        className={`mt-1 font-mono text-sm ${dueSoon ? 'text-flag' : 'text-ink-muted'}`}
                      >
                        Renews {formatDate(policy.renewalDate)}
                        {dueSoon ? ` · in ${String(remaining)} days` : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
