'use client';

import { useMemo, useState, useTransition } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import type { OutstandingItem } from '@/server/db/queries/shopping';
import type { PreferredStoreRow } from '@/server/db/queries/stores';
import { isOpenNow, readOpeningPeriods } from '@/server/domain/store-hours';
import { sortItemsByUrgency, storeUrgency, isOverdue } from '@/server/domain/shopping-urgency';
import { estimateShoppingMinutes } from '@/server/domain/shopping-duration';
import type { PlanRouteResult } from '@/server/services/route.service';
import { deleteItemAction, toggleItemCheckedAction } from '@/app/(dashboard)/shopping/actions';
import { EditPanel } from '@/components/shopping/ShoppingLists';

const UNASSIGNED_KEY = '__unassigned__';
const todayIso = () => new Date().toISOString().slice(0, 10);

interface StoreGroup {
  key: string;
  storeName: string;
  store: PreferredStoreRow | null;
  items: OutstandingItem[];
}

function groupByStore(items: OutstandingItem[], stores: PreferredStoreRow[]): StoreGroup[] {
  const storesByName = new Map(stores.map((store) => [store.name, store]));
  const groups = new Map<string, StoreGroup>();

  for (const item of items) {
    const storeName = item.store;
    const key = storeName ?? UNASSIGNED_KEY;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, {
        key,
        storeName: storeName ?? 'No store set',
        store: storeName ? (storesByName.get(storeName) ?? null) : null,
        items: [item],
      });
    }
  }

  const unassigned = groups.get(UNASSIGNED_KEY);
  groups.delete(UNASSIGNED_KEY);

  const assigned = [...groups.values()].sort((a, b) => {
    const aUrgency = storeUrgency(a.items);
    const bUrgency = storeUrgency(b.items);
    if (aUrgency === null && bUrgency === null) return 0;
    if (aUrgency === null) return 1;
    if (bUrgency === null) return -1;
    return aUrgency.localeCompare(bUrgency);
  });

  return unassigned ? [...assigned, unassigned] : assigned;
}

export function OutstandingStops({
  items,
  stores,
  route,
}: {
  items: OutstandingItem[];
  stores: PreferredStoreRow[];
  route: PlanRouteResult | null;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(() => groupByStore(items, stores), [items, stores]);
  const editingItem = items.find((item) => item.id === editingItemId) ?? null;
  const today = todayIso();
  const now = new Date();

  const orderedGroups = useMemo(() => {
    if (route?.status !== 'planned') return groups;
    const byId = new Map(groups.map((g) => [g.store?.id, g]));
    const routed = route.order
      .map((id) => byId.get(id))
      .filter((g): g is StoreGroup => g !== undefined);
    const rest = groups.filter((g) => !g.store || !route.order.includes(g.store.id));
    return [...routed, ...rest];
  }, [groups, route]);

  function toggleReveal(key: string) {
    setRevealed((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleChecked(id: string) {
    startTransition(() => {
      void toggleItemCheckedAction(id);
    });
  }

  function deleteItem(id: string) {
    startTransition(() => {
      void deleteItemAction(id);
    });
  }

  const totalDriveMinutes =
    route?.status === 'planned' ? route.legMinutes.reduce((sum, m) => sum + m, 0) : 0;
  const totalShopMinutes = groups.reduce(
    (sum, g) => sum + estimateShoppingMinutes(g.items.length),
    0,
  );

  return (
    <div>
      <div className="mb-4 border border-rule bg-surface-2 px-4 py-3">
        <p className="font-mono text-[10px] tracking-widest text-ink-muted uppercase">Route</p>
        {route?.status === 'planned' ? (
          <p className="font-mono text-sm text-ink">
            {totalDriveMinutes + totalShopMinutes} min total ({totalDriveMinutes} min driving)
          </p>
        ) : (
          <p className="font-mono text-sm text-ink-muted">
            {route === null ? 'No store addresses to route through yet.' : 'Not planned yet'}
          </p>
        )}
        {route?.status === 'missing_home_address' && (
          <p className="mt-1 text-xs text-flag">Set a home address on Settings first.</p>
        )}
        {route?.status === 'missing_store_address' && (
          <p className="mt-1 text-xs text-flag">Missing an address for: {route.storeNames.join(', ')}.</p>
        )}
        {route?.status === 'error' && <p className="mt-1 text-xs text-flag">{route.message}</p>}
      </div>

      {orderedGroups.map((group) => {
        const routedIndex =
          route?.status === 'planned' && group.store ? route.order.indexOf(group.store.id) : -1;
        const driveMinutes =
          route?.status === 'planned' && routedIndex >= 0
            ? route.legMinutes[routedIndex]
            : undefined;
        const urgency = storeUrgency(group.items);
        const openingPeriods = group.store ? readOpeningPeriods(group.store.openingHoursPeriods) : null;
        const openNow = isOpenNow(openingPeriods, now);
        const sortedItems = sortItemsByUrgency(group.items);

        return (
          <div key={group.key}>
            {driveMinutes !== undefined && (
              <p className="border-t border-dashed border-ink-muted/60 py-1.5 text-center font-mono text-[11px] text-ink-muted">
                → {driveMinutes} min drive
              </p>
            )}
            <div className="border-t border-rule py-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-sans text-[15px] font-medium text-ink">{group.storeName}</p>
                  {group.key !== UNASSIGNED_KEY && !group.store && (
                    <span className="font-mono text-[10px] text-flag uppercase">
                      no address on file
                    </span>
                  )}
                  {openNow !== null && (
                    <span
                      className={`font-mono text-[10px] uppercase ${openNow ? 'text-ink-muted' : 'text-flag'}`}
                    >
                      {openNow ? 'open now' : 'closed now'}
                    </span>
                  )}
                  {urgency && (
                    <button
                      type="button"
                      onClick={() => {
                        toggleReveal(group.key);
                      }}
                      className="font-mono text-[10px] text-pending uppercase underline"
                    >
                      {revealed[group.key] ? `due ${formatDate(urgency)}` : 'due date ⓘ'}
                    </button>
                  )}
                </div>
                <span className="flex-none font-mono text-[11px] text-ink-muted">
                  {estimateShoppingMinutes(group.items.length)} min
                </span>
              </div>

              <div className="mt-2">
                {sortedItems.map((item) => {
                  const overdue = isOverdue(item.dueAt, today);
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 border-t border-rule py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          toggleChecked(item.id);
                        }}
                        disabled={isPending}
                        className="mt-0.5 h-4 w-4 flex-none border border-control-border bg-transparent"
                        aria-label={`Check off ${item.name}`}
                      />
                      <span className="flex-1">
                        <span className="block font-sans text-sm text-ink">
                          {item.name}
                          {item.quantity > 1 && (
                            <span className="ml-1.5 font-mono text-[11px] text-ink-muted">
                              ×{item.quantity}
                            </span>
                          )}
                        </span>
                        {item.dueAt && (
                          <button
                            type="button"
                            onClick={() => {
                              if (overdue) {
                                setEditingItemId(item.id);
                                return;
                              }
                              toggleReveal(item.id);
                            }}
                            className={`mt-0.5 block font-mono text-[10px] uppercase ${
                              overdue ? 'text-flag underline' : 'text-ink-muted'
                            }`}
                          >
                            {overdue
                              ? 'overdue — tap to reschedule'
                              : revealed[item.id]
                                ? `due ${formatDate(item.dueAt)}`
                                : 'due date ⓘ'}
                          </button>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => {
                          setEditingItemId(editingItemId === item.id ? null : item.id);
                        }}
                        className="flex-none p-0.5 text-ink-muted hover:text-ink"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => {
                          deleteItem(item.id);
                        }}
                        disabled={isPending}
                        className="flex-none p-0.5 text-ink-muted hover:text-flag"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {editingItem && group.items.some((i) => i.id === editingItem.id) && (
                <EditPanel
                  item={editingItem}
                  storeOptions={stores.map((s) => s.name)}
                  onDone={() => {
                    setEditingItemId(null);
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
