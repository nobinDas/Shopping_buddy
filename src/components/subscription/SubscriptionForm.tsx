'use client';

import { useActionState, useState } from 'react';
import { cycleValues, categoryValues } from '@/lib/validation/subscription';
import { minorUnitsToAmountString } from '@/lib/money';
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
}

const initialState: SubscriptionFormState = { error: null };

const fieldClass =
  'border border-rule bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink';
const labelClass = 'text-xs tracking-wide text-ink-muted uppercase';

export function SubscriptionForm({ action, submitLabel, initialValues }: SubscriptionFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [cycle, setCycle] = useState<(typeof cycleValues)[number]>(
    initialValues?.cycle ?? 'monthly',
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Name</span>
        <input name="name" required defaultValue={initialValues?.name} className={fieldClass} />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className={labelClass}>Amount</span>
          <input
            name="amountMinor"
            required
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={
              initialValues ? minorUnitsToAmountString(initialValues.amountMinor) : undefined
            }
            className={`${fieldClass} font-mono`}
          />
        </label>
        <label className="flex w-24 flex-col gap-1">
          <span className={labelClass}>Currency</span>
          <input
            name="currency"
            required
            maxLength={3}
            defaultValue={initialValues?.currency ?? 'USD'}
            className={`${fieldClass} font-mono uppercase`}
          />
        </label>
      </div>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className={labelClass}>Cycle</span>
          <select
            name="cycle"
            value={cycle}
            onChange={(event) => {
              setCycle(event.target.value as (typeof cycleValues)[number]);
            }}
            className={fieldClass}
          >
            {cycleValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {cycle === 'custom' && (
          <label className="flex w-32 flex-col gap-1">
            <span className={labelClass}>Every (days)</span>
            <input
              name="cycleDays"
              type="number"
              min={1}
              required
              defaultValue={initialValues?.cycleDays ?? undefined}
              className={`${fieldClass} font-mono`}
            />
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Anchor date</span>
        <input
          name="anchorDate"
          type="date"
          required
          defaultValue={initialValues?.anchorDate}
          className={`${fieldClass} font-mono`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Category</span>
        <select name="category" defaultValue={initialValues?.category ?? 'software'} className={fieldClass}>
          {categoryValues.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Notes</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initialValues?.notes ?? undefined}
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="bg-ink px-3 py-2 font-mono text-sm text-surface disabled:opacity-60"
      >
        {isPending ? 'Saving…' : submitLabel}
      </button>

      {state.error && <p className="font-mono text-sm text-flag">{state.error}</p>}
    </form>
  );
}
