'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { MonthlyBurnBucket } from '@/server/domain/burn';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

interface BurnMonthsProps {
  /** 12 consecutive calendar-month buckets, starting this month. */
  months: MonthlyBurnBucket[];
}

// Bar geometry: comfortably readable at 390px wide across 12 columns, same
// spirit as the previous ribbon's mark spec (dataviz skill).
const BAR_TRACK_PX = 76;
const MIN_BAR_PX = 4;

export function BurnMonths({ months }: BurnMonthsProps) {
  const [selected, setSelected] = useState(0);

  const maxTotal = Math.max(...months.map((m) => m.totals[0]?.amountMinor ?? 0), 1);
  const active = months[selected];

  return (
    <div>
      <div className="flex items-baseline justify-between pb-2.5">
        <span className="font-mono text-[11px] tracking-wide text-ink-muted uppercase">
          Next 12 months
        </span>
        <span className="font-mono text-[11px] text-ink-muted">tap a month</span>
      </div>

      <div
        className="grid items-end gap-[3px] border-b border-rule"
        style={{
          gridTemplateColumns: `repeat(${String(months.length)}, 1fr)`,
          height: BAR_TRACK_PX,
        }}
      >
        {months.map((month, index) => {
          const total = month.totals[0]?.amountMinor ?? 0;
          const barHeight =
            total === 0 ? MIN_BAR_PX : Math.max(MIN_BAR_PX, (total / maxTotal) * BAR_TRACK_PX);
          return (
            <button
              key={month.monthStart}
              type="button"
              onClick={() => {
                setSelected(index);
              }}
              aria-pressed={index === selected}
              aria-label={`${format(parseISO(month.monthStart), 'MMMM yyyy')}, ${
                month.totals[0] ? formatMoney(month.totals[0]) : 'nothing billed'
              }`}
              className="flex h-full items-end"
            >
              <span
                className={index === selected ? 'w-full bg-ink' : 'w-full bg-ink/70'}
                style={{ height: barHeight }}
              />
            </button>
          );
        })}
      </div>
      <div
        className="grid pt-1.5 font-mono text-[9px] text-ink-muted"
        style={{ gridTemplateColumns: `repeat(${String(months.length)}, 1fr)` }}
      >
        {months.map((month) => (
          <span key={month.monthStart} className="text-center">
            {format(parseISO(month.monthStart), 'MMM').charAt(0)}
          </span>
        ))}
      </div>

      {active && (
        <div className="mt-4 border-t border-rule">
          <div className="flex items-baseline justify-between py-3">
            <span className="font-sans text-sm font-semibold text-ink">
              {format(parseISO(active.monthStart), 'MMMM yyyy')}
            </span>
            <span className="font-mono text-sm text-ink">
              {active.totals.length > 0
                ? active.totals.map((t) => formatMoney(t)).join(' · ')
                : '—'}
            </span>
          </div>
          {active.occurrences.length === 0 ? (
            <p className="border-t border-rule py-3 text-sm text-ink-muted">
              Nothing billing this month.
            </p>
          ) : (
            active.occurrences.map((occ) => (
              <div
                key={occ.id}
                className="flex items-baseline justify-between border-t border-rule py-2.5"
              >
                <span className="text-sm text-ink">{occ.name}</span>
                <span className="flex items-baseline gap-3.5">
                  <span className="font-mono text-[11px] text-ink-muted">
                    {formatDate(occ.date)}
                  </span>
                  <span className="w-[66px] text-right font-mono text-sm text-ink">
                    {formatMoney({ amountMinor: occ.amountMinor, currency: occ.currency })}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
