'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { cycleValues, categoryValues } from '@/lib/validation/subscription';
import { minorUnitsToAmountString } from '@/lib/money';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SubscriptionFormState } from '@/app/(dashboard)/subscriptions/actions';

export interface SubscriptionFormValues {
  name: string;
  amountMinor: number;
  currency: string;
  cycle: (typeof cycleValues)[number];
  cycleDays: number | null;
  anchorDate: string;
  category: (typeof categoryValues)[number];
  notes: string | null;
}

interface SubscriptionFormProps {
  action: (state: SubscriptionFormState, formData: FormData) => Promise<SubscriptionFormState>;
  submitLabel: string;
  initialValues?: SubscriptionFormValues;
  /** Where Cancel goes — the list for a new subscription, the detail page
   * when editing an existing one. Defaults to the list. */
  cancelHref?: string;
}

const initialState: SubscriptionFormState = { error: null };
const labelClass = 'font-mono text-[10px] tracking-wide text-ink-muted uppercase';

const cycleLabels: Record<(typeof cycleValues)[number], string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semiannual',
  annual: 'Annual',
  custom: 'Custom',
};

export function SubscriptionForm({
  action,
  submitLabel,
  initialValues,
  cancelHref = '/subscriptions',
}: SubscriptionFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [cycle, setCycle] = useState<(typeof cycleValues)[number]>(
    initialValues?.cycle ?? 'monthly',
  );
  const [category, setCategory] = useState<(typeof categoryValues)[number]>(
    initialValues?.category ?? 'software',
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="cycle" value={cycle} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-name" className={labelClass}>
          Name
        </Label>
        <Input id="f-name" name="name" required defaultValue={initialValues?.name} />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="f-amt" className={labelClass}>
            Amount
          </Label>
          <Input
            id="f-amt"
            name="amountMinor"
            required
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={
              initialValues ? minorUnitsToAmountString(initialValues.amountMinor) : undefined
            }
            className="font-mono"
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="f-cur" className={labelClass}>
            Currency
          </Label>
          <Input
            id="f-cur"
            name="currency"
            required
            maxLength={3}
            defaultValue={initialValues?.currency ?? 'USD'}
            className="font-mono uppercase"
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
            defaultValue={initialValues?.cycleDays ?? undefined}
            className="font-mono"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-date" className={labelClass}>
          Anchor date
        </Label>
        <Input
          id="f-date"
          name="anchorDate"
          type="date"
          required
          defaultValue={initialValues?.anchorDate}
          className="font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-cat" className={labelClass}>
          Category
        </Label>
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value as (typeof categoryValues)[number]);
          }}
        >
          <SelectTrigger id="f-cat" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryValues.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Radix's Select doesn't submit as a native form field — mirror the
            selected value into a hidden input the server action reads from
            FormData, same pattern as the cycle segmented control above. */}
        <input type="hidden" name="category" value={category} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-notes" className={labelClass}>
          Notes
        </Label>
        <Textarea
          id="f-notes"
          name="notes"
          rows={3}
          defaultValue={initialValues?.notes ?? undefined}
        />
      </div>

      <div className="mt-1 flex gap-2.5">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-ink py-3 font-sans text-sm font-medium text-surface disabled:opacity-60"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="flex items-center border border-control-border px-5 font-sans text-sm font-medium text-ink"
        >
          Cancel
        </Link>
      </div>

      {state.error && <p className="font-mono text-sm text-flag">{state.error}</p>}
    </form>
  );
}
