'use client';

import { useState } from 'react';
import Link from 'next/link';
import { addMinutes, format, parseISO, subMinutes } from 'date-fns';

/**
 * Phase 1.5 mock data — no route-planning schema or mapping API exists yet
 * (Phase 4). Drive times and store hours are hand-picked, not routed, but
 * the leave-by and feasibility arithmetic below is real: it's the actual
 * shape Phase 4's real computation needs, just fed fixture numbers instead
 * of a mapping API response.
 */
interface MockChecklistItem {
  id: string;
  name: string;
  listName: string;
  priceLabel: string;
}

interface MockStop {
  id: string;
  storeName: string;
  listNames: string[];
  driveMinutesFromPrevious: number;
  minutesAtStore: number;
  opensAt: string;
  closesAt: string;
  items: MockChecklistItem[];
}

interface MockTrip {
  id: string;
  label: string;
  dueAt: string;
  stops: MockStop[];
}

const trips: MockTrip[] = [
  {
    id: 'evening-errands',
    label: 'Evening errands',
    dueAt: '2026-08-25T18:00:00',
    stops: [
      {
        id: '1',
        storeName: "Trader Joe's",
        listNames: ['Grocery'],
        driveMinutesFromPrevious: 12,
        minutesAtStore: 20,
        opensAt: '08:00',
        closesAt: '22:00',
        items: [
          { id: 'i1', name: 'Milk, 1gal', listName: 'Grocery', priceLabel: '$4.49' },
          { id: 'i2', name: 'Eggs, dozen', listName: 'Grocery', priceLabel: '$5.99' },
          { id: 'i3', name: 'Sourdough loaf', listName: 'Grocery', priceLabel: '—' },
        ],
      },
      {
        id: '2',
        storeName: 'Costco',
        listNames: ['Household'],
        driveMinutesFromPrevious: 15,
        minutesAtStore: 35,
        opensAt: '10:00',
        closesAt: '20:30',
        items: [
          { id: 'i4', name: 'Paper towels, 6-pack', listName: 'Household', priceLabel: '$18.99' },
          { id: 'i5', name: 'Dish soap', listName: 'Household', priceLabel: '$3.99' },
        ],
      },
    ],
  },
  {
    id: 'before-the-party',
    label: 'Before the party',
    dueAt: '2026-08-25T09:00:00',
    stops: [
      {
        id: '3',
        storeName: 'Party City',
        listNames: ['One-off'],
        driveMinutesFromPrevious: 10,
        minutesAtStore: 10,
        opensAt: '10:00',
        closesAt: '21:00',
        items: [{ id: 'i6', name: 'Birthday candles', listName: 'One-off', priceLabel: '$2.99' }],
      },
    ],
  },
];

type InfeasibleReason = 'before opening' | 'after closing' | null;

interface StopTiming {
  stop: MockStop;
  arrival: Date;
  departure: Date;
  infeasibleReason: InfeasibleReason;
}

function scheduleTrip(trip: MockTrip): { leaveBy: Date; stops: StopTiming[]; feasible: boolean } {
  const due = parseISO(trip.dueAt);
  const totalMinutes = trip.stops.reduce(
    (sum, stop) => sum + stop.driveMinutesFromPrevious + stop.minutesAtStore,
    0,
  );
  const leaveBy = subMinutes(due, totalMinutes);

  let cursor = leaveBy;
  const stops: StopTiming[] = trip.stops.map((stop) => {
    const arrival = addMinutes(cursor, stop.driveMinutesFromPrevious);
    const departure = addMinutes(arrival, stop.minutesAtStore);
    cursor = departure;

    const arrivalMinutes = arrival.getHours() * 60 + arrival.getMinutes();
    const [openH = 0, openM = 0] = stop.opensAt.split(':').map(Number);
    const [closeH = 0, closeM = 0] = stop.closesAt.split(':').map(Number);
    let infeasibleReason: InfeasibleReason = null;
    if (arrivalMinutes < openH * 60 + openM) {
      infeasibleReason = 'before opening';
    } else if (arrivalMinutes > closeH * 60 + closeM) {
      infeasibleReason = 'after closing';
    }

    return { stop, arrival, departure, infeasibleReason };
  });

  return { leaveBy, stops, feasible: stops.every((s) => s.infeasibleReason === null) };
}

export default function TripsPage() {
  const [openStops, setOpenStops] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  function toggleStop(id: string) {
    setOpenStops((current) => ({ ...current, [id]: !current[id] }));
  }

  function toggleItem(id: string) {
    setCheckedItems((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <main className="flex min-h-screen flex-col gap-8 px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>

      {trips.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            No trips planned yet. Add a deadline to a shopping list to plan one.
          </p>
        </div>
      ) : (
        trips.map((trip) => {
          const { leaveBy, stops, feasible } = scheduleTrip(trip);
          const listNames = [...new Set(trip.stops.flatMap((s) => s.listNames))];

          return (
            <div key={trip.id}>
              <p className="font-display text-[28px] leading-none tracking-tight">{trip.label}</p>
              <p className="mt-1 mb-5 font-mono text-xs text-ink-muted uppercase">
                DUE {format(parseISO(trip.dueAt), 'HH:mm')} · {listNames.join(' + ').toUpperCase()}
                {!feasible ? ' · NOT FEASIBLE' : ''}
              </p>

              <div className="mb-5 bg-ink p-4 text-surface">
                <p className="mb-1.5 font-mono text-[10px] tracking-widest text-surface/65">
                  LEAVE BY
                </p>
                <p className="font-mono text-4xl leading-none">{format(leaveBy, 'HH:mm')}</p>
                <p className="mt-1.5 text-xs text-surface/65">
                  Computed backward from {format(parseISO(trip.dueAt), 'HH:mm')} across{' '}
                  {stops.length} stop{stops.length === 1 ? '' : 's'}.
                </p>
              </div>

              <div className="border-b border-rule">
                {stops.map(({ stop, arrival, infeasibleReason }) => (
                  <div key={stop.id} className="border-t border-rule">
                    <button
                      type="button"
                      onClick={() => {
                        toggleStop(stop.id);
                      }}
                      className="grid w-full grid-cols-[56px_1fr_16px] items-start py-3.5 text-left"
                    >
                      <span
                        className={`font-mono text-[13px] ${infeasibleReason ? 'text-flag' : 'text-ink'}`}
                      >
                        {format(arrival, 'HH:mm')}
                      </span>
                      <span className="border-l border-rule pl-3.5">
                        <span className="block font-sans text-[15px] font-medium text-ink">
                          {stop.storeName}
                        </span>
                        <span className="block font-mono text-[11px] text-ink-muted">
                          {stop.listNames.join(', ')} · open {stop.opensAt}–{stop.closesAt}
                        </span>
                        {infeasibleReason && (
                          <span className="mt-1.5 block text-xs text-flag">
                            Arrives {infeasibleReason}. Reorder stops or leave earlier.
                          </span>
                        )}
                      </span>
                      <span className="pt-0.5 text-right font-mono text-xs text-ink-muted">
                        {openStops[stop.id] ? '▲' : '▼'}
                      </span>
                    </button>

                    {openStops[stop.id] && (
                      <div className="pb-3.5 pl-[70px]">
                        {stop.items.map((item) => {
                          const isChecked = Boolean(checkedItems[item.id]);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                toggleItem(item.id);
                              }}
                              className="flex w-full items-start gap-3 border-t border-rule py-2.5 text-left"
                            >
                              <span
                                className={`mt-0.5 h-4 w-4 flex-none border border-control-border ${
                                  isChecked ? 'bg-ink' : 'bg-transparent'
                                }`}
                              />
                              <span className={isChecked ? 'flex-1 opacity-55' : 'flex-1'}>
                                <span
                                  className={`block font-sans text-sm text-ink ${
                                    isChecked ? 'line-through' : ''
                                  }`}
                                >
                                  {item.name}
                                </span>
                                <span className="block font-mono text-[10px] text-ink-muted">
                                  {item.listName}
                                </span>
                              </span>
                              <span className="flex-none font-mono text-[13px] text-ink">
                                {item.priceLabel}
                              </span>
                            </button>
                          );
                        })}
                        <p className="border-t border-rule pt-2.5 font-mono text-[11px] text-ink-muted">
                          {stop.items.filter((item) => checkedItems[item.id]).length} of{' '}
                          {stop.items.length} checked off
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </main>
  );
}
