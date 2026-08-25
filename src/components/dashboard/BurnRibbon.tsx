'use client';

import type { CSSProperties } from 'react';
import { differenceInCalendarDays, eachMonthOfInterval, format, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

export interface RibbonBand {
  /** Unique per occurrence — a subscription can appear many times in one window. */
  id: string;
  subscriptionId: string;
  name: string;
  amountMinor: number;
  currency: string;
  /** ISO 'yyyy-MM-dd', the occurrence's billing date. */
  date: string;
}

interface BurnRibbonProps {
  bands: RibbonBand[];
  /** Both ISO 'yyyy-MM-dd', both inclusive — the twelve-month window drawn. */
  windowStart: string;
  windowEnd: string;
}

// Mark spec: ≤24px thick, comfortably under that; a 2px gap separates same-day
// bands the way it separates any other touching mark. See dataviz skill,
// marks-and-anatomy.md.
const BAND_THICKNESS_PX = 6;
const BAND_GAP_PX = 2;
const MIN_SIZE_PX = 8;
const MAX_SIZE_PX = 140;

interface PositionedBand {
  band: RibbonBand;
  /** 0–1 position along the time axis. */
  offset: number;
  /** The scaled length (height on desktop, width on mobile), in px. */
  size: number;
  /** Perpendicular offset in px, for bands sharing the same day. */
  lateralOffsetPx: number;
}

function layoutBands(
  bands: RibbonBand[],
  windowStart: string,
  windowEnd: string,
): PositionedBand[] {
  const start = parseISO(windowStart);
  const totalDays = Math.max(differenceInCalendarDays(parseISO(windowEnd), start), 1);
  const maxAmount = Math.max(...bands.map((b) => b.amountMinor), 1);

  // Group by exact date so occurrences that land on the same day sit side by
  // side instead of fully overlapping — the clustering itself is the point
  // of this chart (DESIGN.md: "three annual renewals landing in the same
  // fortnight is a fact about your year").
  const byDate = new Map<string, RibbonBand[]>();
  for (const b of bands) {
    const group = byDate.get(b.date);
    if (group) {
      group.push(b);
    } else {
      byDate.set(b.date, [b]);
    }
  }

  const positioned: PositionedBand[] = [];
  for (const group of byDate.values()) {
    const step = BAND_THICKNESS_PX + BAND_GAP_PX;
    group.forEach((band, index) => {
      const centered = index - (group.length - 1) / 2;
      const offset = differenceInCalendarDays(parseISO(band.date), start) / totalDays;
      const size = MIN_SIZE_PX + (MAX_SIZE_PX - MIN_SIZE_PX) * (band.amountMinor / maxAmount);
      positioned.push({ band, offset, size, lateralOffsetPx: centered * step });
    });
  }
  return positioned;
}

function BandMark({
  positioned,
  axis,
}: {
  positioned: PositionedBand;
  axis: 'horizontal' | 'vertical';
}) {
  const { band, offset, size, lateralOffsetPx } = positioned;

  const style: CSSProperties =
    axis === 'horizontal'
      ? {
          left: `calc(${String(offset * 100)}% + ${String(lateralOffsetPx)}px)`,
          bottom: 0,
          width: BAND_THICKNESS_PX,
          height: size,
        }
      : {
          top: `calc(${String(offset * 100)}% + ${String(lateralOffsetPx)}px)`,
          left: 0,
          height: BAND_THICKNESS_PX,
          width: size,
        };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={
            axis === 'horizontal'
              ? 'absolute -translate-x-1/2 rounded-t-[4px] bg-surface transition-opacity hover:opacity-80 focus-visible:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface'
              : 'absolute -translate-y-1/2 rounded-r-[4px] bg-surface transition-opacity hover:opacity-80 focus-visible:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface'
          }
          style={style}
          aria-label={`${band.name}, ${formatMoney({ amountMinor: band.amountMinor, currency: band.currency })}, ${formatDate(band.date)}`}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-mono text-sm font-semibold">
          {formatMoney({ amountMinor: band.amountMinor, currency: band.currency })}
        </p>
        <p className="text-xs text-muted-foreground">
          {band.name} · {formatDate(band.date)}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function BurnRibbon({ bands, windowStart, windowEnd }: BurnRibbonProps) {
  const positioned = layoutBands(bands, windowStart, windowEnd);
  const months = eachMonthOfInterval({ start: parseISO(windowStart), end: parseISO(windowEnd) });
  const start = parseISO(windowStart);
  const totalDays = Math.max(differenceInCalendarDays(parseISO(windowEnd), start), 1);

  if (bands.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded bg-ground text-sm text-surface/60 md:h-48">
        Nothing on the books for the next year yet.
      </div>
    );
  }

  return (
    <div>
      {/* Desktop: one continuous horizontal timeline, twelve months left to
          right. Bands grow up from the baseline, thickness encodes nothing,
          height encodes amount. */}
      <div className="hidden md:block">
        <div className="relative h-48 rounded bg-ground">
          {positioned.map((p) => (
            <BandMark key={p.band.id} positioned={p} axis="horizontal" />
          ))}
        </div>
        <div className="relative mt-2 h-4">
          {months.map((month) => {
            const offset = differenceInCalendarDays(month, start) / totalDays;
            return (
              <span
                key={month.toISOString()}
                className="absolute -translate-x-1/2 font-mono text-xs text-ink-muted"
                style={{ left: `${String(offset * 100)}%` }}
              >
                {format(month, 'MMM')}
              </span>
            );
          })}
        </div>
      </div>

      {/* Mobile: the same timeline rotated — a horizontally scrolling chart
          would hide exactly the clustering this exists to show, so months
          run top to bottom instead. Bands grow right from the baseline. */}
      <div className="flex gap-3 md:hidden">
        <div className="relative h-96 w-8 text-right">
          {months.map((month) => {
            const offset = differenceInCalendarDays(month, start) / totalDays;
            return (
              <span
                key={month.toISOString()}
                className="absolute -translate-y-1/2 font-mono text-xs text-ink-muted"
                style={{ top: `${String(offset * 100)}%`, right: 0 }}
              >
                {format(month, 'MMM')}
              </span>
            );
          })}
        </div>
        <div className="relative h-96 flex-1 rounded bg-ground">
          {positioned.map((p) => (
            <BandMark key={p.band.id} positioned={p} axis="vertical" />
          ))}
        </div>
      </div>
    </div>
  );
}
