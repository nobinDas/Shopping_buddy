'use client';

import { useState, useTransition } from 'react';
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
} from '@/components/ui/dialog';
import { cycleValues } from '@/lib/validation/subscription';
import { formatMoney, minorUnitsToAmountString } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { PolicyRow } from '@/server/db/queries/insurance';
import {
  createPolicyAction,
  updatePolicyAction,
  archivePolicyAction,
  restorePolicyAction,
} from '@/app/(dashboard)/insurance/actions';

const typeLabel: Record<PolicyRow['type'], string> = {
  medical: 'Medical',
  auto: 'Auto',
};

const cycleLabels: Record<(typeof cycleValues)[number], string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semiannual',
  annual: 'Annual',
  custom: 'Custom',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateIso: string): number {
  return Math.round((new Date(dateIso).getTime() - new Date(today()).getTime()) / 86_400_000);
}

// nextBillingDate is computed server-side (insurance/page.tsx) and passed
// in as a plain string — domain/billing-cycle.ts lives under src/server/
// and this is a 'use client' component, which must never import from
// src/server/** (docs/ARCHITECTURE.md's boundary rule).
export type PolicyWithNextBillingDate = PolicyRow & { nextBillingDate: string };

type DialogState = { mode: 'create' } | { mode: 'edit'; policy: PolicyRow } | null;

function PolicyForm({ policy, onSaved }: { policy?: PolicyRow; onSaved: () => void }) {
  const [type, setType] = useState<PolicyRow['type']>(policy?.type ?? 'auto');
  const [cycle, setCycle] = useState<(typeof cycleValues)[number]>(policy?.cycle ?? 'semiannual');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const labelClass = 'font-mono text-[10px] tracking-wide text-ink-muted uppercase';

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set('type', type);
        formData.set('cycle', cycle);

        startTransition(() => {
          void (async () => {
            const result = policy
              ? await updatePolicyAction(policy.id, formData)
              : await createPolicyAction(formData);
            if (result.error) {
              setError(result.error);
            } else {
              setError(null);
              onSaved();
            }
          })();
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-type" className={labelClass}>
          Type
        </Label>
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value as PolicyRow['type']);
          }}
        >
          <SelectTrigger id="f-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="medical">Medical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-insurer" className={labelClass}>
          Insurer
        </Label>
        <Input id="f-insurer" name="insurer" required defaultValue={policy?.insurer} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-policyNumber" className={labelClass}>
          Policy number
        </Label>
        <Input
          id="f-policyNumber"
          name="policyNumber"
          required
          className="font-mono"
          defaultValue={policy?.policyNumber}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="f-premium" className={labelClass}>
            Premium
          </Label>
          <Input
            id="f-premium"
            name="premiumMinor"
            required
            inputMode="decimal"
            placeholder="0.00"
            className="font-mono"
            defaultValue={policy ? minorUnitsToAmountString(policy.premiumMinor) : undefined}
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="f-currency" className={labelClass}>
            Currency
          </Label>
          <Input
            id="f-currency"
            name="currency"
            required
            maxLength={3}
            className="font-mono uppercase"
            defaultValue={policy?.currency ?? 'USD'}
          />
        </div>
      </div>

      <div>
        <p className={`${labelClass} mb-1.5`}>Billing cycle</p>
        <div className="grid grid-cols-4 border border-control-border">
          {cycleValues.map((value, index) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setCycle(value);
              }}
              aria-pressed={cycle === value}
              className={`h-11 font-sans text-xs font-medium ${
                index > 0 ? 'border-l border-control-border' : ''
              } ${cycle === value ? 'bg-ink text-surface' : 'bg-transparent text-ink'}`}
            >
              {cycleLabels[value]}
            </button>
          ))}
        </div>
      </div>

      {cycle === 'custom' && (
        <div className="flex w-32 flex-col gap-1.5">
          <Label htmlFor="f-days" className={labelClass}>
            Every (days)
          </Label>
          <Input
            id="f-days"
            name="cycleDays"
            type="number"
            min={1}
            required
            className="font-mono"
            defaultValue={policy?.cycleDays ?? undefined}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-anchorDate" className={labelClass}>
          {policy ? 'Last renewal date' : 'Start / last renewal date'}
        </Label>
        <Input
          id="f-anchorDate"
          name="anchorDate"
          type="date"
          required
          className="font-mono"
          defaultValue={policy?.anchorDate}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-reminderLeadDays" className={labelClass}>
          Remind me (days before)
        </Label>
        <Input
          id="f-reminderLeadDays"
          name="reminderLeadDays"
          type="number"
          min={1}
          className="font-mono"
          defaultValue={policy?.reminderLeadDays ?? 30}
        />
      </div>

      {error && <p className="font-mono text-sm text-flag">{error}</p>}

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : policy ? 'Save changes' : 'Add policy'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PolicyList({ policies }: { policies: PolicyWithNextBillingDate[] }) {
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isPending, startTransition] = useTransition();

  function archive(id: string) {
    startTransition(() => {
      void archivePolicyAction(id);
    });
  }

  function restore(id: string) {
    startTransition(() => {
      void restorePolicyAction(id);
    });
  }

  return (
    <>
      {policies.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            No policies tracked yet. Add the first one you know is due for renewal.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {policies.map((policy) => {
            const archived = policy.status === 'archived';
            const remaining = daysUntil(policy.nextBillingDate);
            const dueSoon = !archived && remaining <= policy.reminderLeadDays;

            return (
              <div
                key={policy.id}
                className={`border border-rule p-4 ${archived ? 'opacity-55' : ''}`}
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="font-sans text-base font-medium text-ink">{policy.insurer}</span>
                  {archived ? (
                    <span className="font-mono text-[10px] tracking-widest text-ink-muted">
                      ARCHIVED
                    </span>
                  ) : dueSoon ? (
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
                    <p className="mb-1 font-mono text-[10px] text-ink-muted">CYCLE</p>
                    <p className="text-sm text-ink">{cycleLabels[policy.cycle]}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] text-ink-muted">POLICY</p>
                    <p className="font-mono text-[13px] text-ink">{policy.policyNumber}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] text-ink-muted">
                      {archived ? 'LAST RENEWAL' : 'RENEWS'}
                    </p>
                    <p className="font-mono text-[13px] text-ink">
                      {formatDate(archived ? policy.anchorDate : policy.nextBillingDate)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 border-t border-rule pt-3">
                  {archived ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        restore(policy.id);
                      }}
                      className="font-mono text-[11px] text-ink underline"
                    >
                      RESTORE
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDialogState({ mode: 'edit', policy });
                        }}
                        className="font-mono text-[11px] text-ink underline"
                      >
                        EDIT
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          archive(policy.id);
                        }}
                        className="font-mono text-[11px] text-ink-muted underline"
                      >
                        ARCHIVE
                      </button>
                    </>
                  )}
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

      <Button
        onClick={() => {
          setDialogState({ mode: 'create' });
        }}
        className="h-12 w-full rounded-none bg-ink text-sm font-medium text-surface hover:bg-ink/90"
      >
        Add a policy
      </Button>

      <Dialog
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === 'edit' ? 'Edit insurance policy' : 'Add insurance policy'}
            </DialogTitle>
          </DialogHeader>
          {dialogState?.mode === 'edit' && (
            <PolicyForm
              key={dialogState.policy.id}
              policy={dialogState.policy}
              onSaved={() => {
                setDialogState(null);
              }}
            />
          )}
          {dialogState?.mode === 'create' && (
            <PolicyForm
              key="create"
              onSaved={() => {
                setDialogState(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
