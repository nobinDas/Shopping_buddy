'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addMoney, formatMoney, type Money } from '@/lib/money';

/**
 * Phase 1.5 mock data — no shopping-list schema exists yet (Phase 3). A
 * null `unitPriceMinor` means "not looked up yet," not zero — see
 * docs/DESIGN.md: "'$0.00' and '—' mean different things."
 */
interface MockItem {
  id: string;
  name: string;
  store: string | null;
  notes: string | null;
  unitPriceMinor: number | null;
  currency: string;
}

interface MockList {
  id: string;
  name: string;
  items: MockItem[];
}

const initialLists: MockList[] = [
  {
    id: 'grocery',
    name: 'Grocery',
    items: [
      { id: '1', name: "Milk, 1gal", store: "Trader Joe's", notes: null, unitPriceMinor: 449, currency: 'USD' },
      {
        id: '2',
        name: 'Eggs, dozen',
        store: "Trader Joe's",
        notes: 'Free-range if they have it',
        unitPriceMinor: 599,
        currency: 'USD',
      },
      { id: '3', name: 'Sourdough loaf', store: null, notes: null, unitPriceMinor: null, currency: 'USD' },
    ],
  },
  {
    id: 'household',
    name: 'Household',
    items: [
      {
        id: '4',
        name: 'Paper towels, 6-pack',
        store: 'Costco',
        notes: null,
        unitPriceMinor: 1899,
        currency: 'USD',
      },
      { id: '5', name: 'Dish soap', store: null, notes: null, unitPriceMinor: 399, currency: 'USD' },
    ],
  },
  { id: 'personal', name: 'Personal', items: [] },
  {
    id: 'one-off',
    name: 'One-off',
    items: [
      {
        id: '6',
        name: 'Birthday candles',
        store: null,
        notes: 'For Saturday',
        unitPriceMinor: 299,
        currency: 'USD',
      },
    ],
  },
];

const STORE_OPTIONS = ["Trader Joe's", 'Costco', 'Eastside Market', 'Harbor Hardware'];

function listSubtotal(items: MockItem[], checked: Record<string, boolean>): Money | null {
  const [first, ...rest] = items.filter(
    (item): item is MockItem & { unitPriceMinor: number } =>
      item.unitPriceMinor !== null && !checked[item.id],
  );
  if (!first) return null;

  const firstMoney: Money = { amountMinor: first.unitPriceMinor, currency: first.currency };
  return rest.reduce<Money>(
    (total, item) => addMoney(total, { amountMinor: item.unitPriceMinor, currency: item.currency }),
    firstMoney,
  );
}

export default function ShoppingListsPage() {
  const [lists, setLists] = useState<MockList[]>(initialLists);
  const [activeListId, setActiveListId] = useState(initialLists[0]?.id ?? '');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  function toggleChecked(id: string) {
    setChecked((current) => ({ ...current, [id]: !current[id] }));
  }

  function setItemStore(listId: string, itemId: string, store: string) {
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId
                  ? { ...item, store: store === '__none__' ? null : store }
                  : item,
              ),
            }
          : list,
      ),
    );
  }

  function addItem(listId: string) {
    const name = draft.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: [
                ...list.items,
                { id, name, store: null, notes: null, unitPriceMinor: null, currency: 'USD' },
              ],
            }
          : list,
      ),
    );
    setDraft('');
    setEditingItemId(id);
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <p className="font-display text-[28px] tracking-tight">Shopping</p>

      <Tabs value={activeListId} onValueChange={setActiveListId}>
        <TabsList>
          {lists.map((list) => (
            <TabsTrigger key={list.id} value={list.id}>
              {list.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {lists.map((list) => {
          const total = listSubtotal(list.items, checked);
          const unpricedCount = list.items.filter(
            (item) => item.unitPriceMinor === null && !checked[item.id],
          ).length;

          return (
            <TabsContent key={list.id} value={list.id}>
              {list.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
                  <p className="text-base text-ink">
                    Nothing on this list yet. Add the first item you need.
                  </p>
                </div>
              ) : (
                list.items.map((item) => {
                  const isChecked = Boolean(checked[item.id]);
                  return (
                    <div key={item.id} className="border-b border-rule py-3.5">
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            toggleChecked(item.id);
                          }}
                          className="flex flex-1 items-start gap-3 text-left"
                        >
                          <span
                            className={`mt-0.5 h-4 w-4 flex-none border border-control-border ${
                              isChecked ? 'bg-ink' : 'bg-transparent'
                            }`}
                          />
                          <span className={isChecked ? 'flex-1 opacity-55' : 'flex-1'}>
                            <span
                              className={`block font-sans text-[15px] text-ink ${
                                isChecked ? 'line-through' : ''
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="block font-mono text-[11px] text-ink-muted uppercase">
                              {item.store ?? 'No store set'}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Change store for ${item.name}`}
                          onClick={() => {
                            setEditingItemId(editingItemId === item.id ? null : item.id);
                          }}
                          className="flex-none p-0.5 text-ink-muted hover:text-ink"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <span className="flex-none pt-px font-mono text-sm text-ink">
                          {item.unitPriceMinor === null
                            ? '—'
                            : formatMoney({
                                amountMinor: item.unitPriceMinor,
                                currency: item.currency,
                              })}
                        </span>
                      </div>

                      {editingItemId === item.id && (
                        <div className="mt-3 flex gap-2 pl-[26px]">
                          <Select
                            value={item.store ?? '__none__'}
                            onValueChange={(value) => {
                              setItemStore(list.id, item.id, value);
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No store set</SelectItem>
                              {STORE_OPTIONS.map((store) => (
                                <SelectItem key={store} value={store}>
                                  {store}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemId(null);
                            }}
                            className="flex-none border border-control-border px-3.5 font-sans text-[13px] font-medium text-ink"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <div className="flex items-center gap-3 border-b border-dashed border-ink-muted/60 py-3.5">
                <span className="h-4 w-4 flex-none border border-dashed border-ink-muted/60" />
                <input
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addItem(list.id);
                  }}
                  placeholder="New item"
                  aria-label="New item"
                  className="min-w-0 flex-1 bg-transparent font-sans text-[15px] text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    addItem(list.id);
                  }}
                  disabled={!draft.trim()}
                  className="flex-none border border-control-border px-3 py-1.5 font-sans text-xs font-medium text-ink disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              <p className="pt-2 pl-[26px] text-[11px] leading-relaxed text-ink-muted">
                New items land with no store set. Use the pencil to pick one.
              </p>

              <div className="flex items-baseline justify-between pt-4 pb-1">
                <span className="font-mono text-[11px] tracking-wide text-ink-muted uppercase">
                  Priced subtotal
                </span>
                <span className="font-mono text-xl text-ink">{total ? formatMoney(total) : '—'}</span>
              </div>
              {unpricedCount > 0 && (
                <p className="text-[13px] text-ink-muted">
                  {unpricedCount} item{unpricedCount === 1 ? '' : 's'} not priced yet.
                </p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </main>
  );
}
