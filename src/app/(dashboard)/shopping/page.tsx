'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { addMoney, formatMoney, parseAmountToMinorUnits, type Money } from '@/lib/money';

/**
 * Phase 1.5 mock data — no shopping-list schema exists yet (Phase 3). A
 * null `unitPriceMinor` means "not looked up yet," not zero — see
 * docs/DESIGN.md: "'$0.00' and '—' mean different things."
 */
interface MockItem {
  id: string;
  name: string;
  quantity: number;
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
      {
        id: '1',
        name: 'Milk, 1gal',
        quantity: 2,
        store: "Trader Joe's",
        notes: null,
        unitPriceMinor: 449,
        currency: 'USD',
      },
      {
        id: '2',
        name: 'Eggs, dozen',
        quantity: 1,
        store: "Trader Joe's",
        notes: 'Free-range if they have it',
        unitPriceMinor: 599,
        currency: 'USD',
      },
      {
        id: '3',
        name: 'Sourdough loaf',
        quantity: 1,
        store: null,
        notes: null,
        unitPriceMinor: null,
        currency: 'USD',
      },
    ],
  },
  {
    id: 'household',
    name: 'Household',
    items: [
      {
        id: '4',
        name: 'Paper towels, 6-pack',
        quantity: 1,
        store: 'Costco',
        notes: null,
        unitPriceMinor: 1899,
        currency: 'USD',
      },
      {
        id: '5',
        name: 'Dish soap',
        quantity: 2,
        store: null,
        notes: null,
        unitPriceMinor: 399,
        currency: 'USD',
      },
    ],
  },
  {
    id: 'personal',
    name: 'Personal',
    items: [],
  },
  {
    id: 'one-off',
    name: 'One-off',
    items: [
      {
        id: '6',
        name: 'Birthday candles',
        quantity: 1,
        store: null,
        notes: 'For Saturday',
        unitPriceMinor: 299,
        currency: 'USD',
      },
    ],
  },
];

/** `FormData.get` returns `FormDataEntryValue | null` — a text field is a
 * `string`, never a `File`, so this narrows without needing a cast. */
function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function listTotal(items: MockItem[]): Money | null {
  const [first, ...rest] = items.filter(
    (item): item is MockItem & { unitPriceMinor: number } => item.unitPriceMinor !== null,
  );
  if (!first) return null;

  const firstSubtotal: Money = {
    amountMinor: first.unitPriceMinor * first.quantity,
    currency: first.currency,
  };
  return rest.reduce<Money>(
    (total, item) =>
      addMoney(total, {
        amountMinor: item.unitPriceMinor * item.quantity,
        currency: item.currency,
      }),
    firstSubtotal,
  );
}

function AddItemForm({ onAdd }: { onAdd: (item: MockItem) => void }) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const priceRaw = getFormString(formData, 'unitPrice');
        const unitPriceMinor = priceRaw ? parseAmountToMinorUnits(priceRaw) : null;

        onAdd({
          id: crypto.randomUUID(),
          name: getFormString(formData, 'name'),
          quantity: Number(formData.get('quantity') ?? 1),
          store: getFormString(formData, 'store') || null,
          notes: getFormString(formData, 'notes') || null,
          unitPriceMinor,
          currency: 'USD',
        });
        event.currentTarget.reset();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Item</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            className="font-mono"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="unitPrice">Price (optional)</Label>
          <Input
            id="unitPrice"
            name="unitPrice"
            inputMode="decimal"
            placeholder="0.00"
            className="font-mono"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="store">Store (optional)</Label>
        <Input id="store" name="store" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" name="notes" />
      </div>
      <DialogFooter>
        <Button type="submit">Add item</Button>
      </DialogFooter>
    </form>
  );
}

export default function ShoppingListsPage() {
  const [lists, setLists] = useState<MockList[]>(initialLists);
  const [activeListId, setActiveListId] = useState(initialLists[0]?.id ?? '');
  const [open, setOpen] = useState(false);

  function addItem(listId: string, item: MockItem) {
    setLists((current) =>
      current.map((list) =>
        list.id === listId ? { ...list, items: [...list.items, item] } : list,
      ),
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header>
        <Link href="/" className="font-mono text-xs text-ink-muted underline">
          ← Overhead
        </Link>
        <p className="mt-2 font-display text-2xl">Shopping lists</p>
      </header>

      <Tabs value={activeListId} onValueChange={setActiveListId}>
        <TabsList>
          {lists.map((list) => (
            <TabsTrigger key={list.id} value={list.id}>
              {list.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {lists.map((list) => {
          const total = listTotal(list.items);
          const unpricedCount = list.items.filter((item) => item.unitPriceMinor === null).length;

          return (
            <TabsContent key={list.id} value={list.id} className="mt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-wide text-ink-muted uppercase">
                  {list.items.length} item{list.items.length === 1 ? '' : 's'}
                </p>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">Add item</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add item to {list.name}</DialogTitle>
                    </DialogHeader>
                    <AddItemForm
                      onAdd={(item) => {
                        addItem(list.id, item);
                        setOpen(false);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {list.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded border border-rule bg-surface-2 p-12 text-center">
                  <p className="text-base text-ink">
                    Nothing on this list yet. Add the first item you need.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p>{item.name}</p>
                          {item.notes && <p className="text-xs text-ink-muted">{item.notes}</p>}
                        </TableCell>
                        <TableCell className="text-sm text-ink-muted">
                          {item.store ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.unitPriceMinor === null
                            ? '—'
                            : formatMoney({
                                amountMinor: item.unitPriceMinor,
                                currency: item.currency,
                              })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.unitPriceMinor === null
                            ? '—'
                            : formatMoney({
                                amountMinor: item.unitPriceMinor * item.quantity,
                                currency: item.currency,
                              })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {list.items.length > 0 && (
                <div className="flex items-center justify-between border-t border-rule pt-4">
                  <p className="text-xs tracking-wide text-ink-muted uppercase">Estimated total</p>
                  <div className="text-right">
                    <p className="font-mono text-xl text-ink">{total ? formatMoney(total) : '—'}</p>
                    {unpricedCount > 0 && (
                      <p className="font-mono text-xs text-ink-muted">
                        {unpricedCount} item{unpricedCount === 1 ? '' : 's'} not priced
                      </p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </main>
  );
}
