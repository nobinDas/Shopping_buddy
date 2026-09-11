'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ListWithItems, ShoppingItemRow } from '@/server/db/queries/shopping';
import {
  addItemAction,
  updateItemAction,
  deleteItemAction,
  toggleItemCheckedAction,
} from '@/app/(dashboard)/shopping/actions';

export function EditPanel({
  item,
  storeOptions,
  onDone,
}: {
  item: ShoppingItemRow;
  storeOptions: string[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [store, setStore] = useState(item.store ?? '__none__');

  return (
    <form
      className="mt-3 flex flex-col gap-2.5 pl-[26px]"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => {
          void (async () => {
            await updateItemAction(item.id, formData);
            onDone();
          })();
        });
      }}
    >
      <div className="flex gap-2">
        <input
          name="name"
          defaultValue={item.name}
          aria-label="Item name"
          className="min-w-0 flex-1 border border-control-border bg-surface px-3 py-2 text-sm text-ink outline-none"
        />
        <input
          name="quantity"
          type="number"
          min={1}
          defaultValue={item.quantity}
          aria-label="Quantity"
          className="w-16 border border-control-border bg-surface px-2 py-2 text-center font-mono text-sm text-ink outline-none"
        />
      </div>
      <input
        name="notes"
        defaultValue={item.notes ?? ''}
        placeholder="Notes (optional)"
        aria-label="Notes"
        className="border border-control-border bg-surface px-3 py-2 text-sm text-ink outline-none"
      />
      <label className="flex flex-col gap-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
        Due date (optional)
        <input
          name="dueAt"
          type="date"
          defaultValue={item.dueAt ?? ''}
          aria-label="Due date"
          className="border border-control-border bg-surface px-3 py-2 font-sans text-sm text-ink outline-none normal-case"
        />
      </label>
      <div className="flex gap-2">
        <Select value={store} onValueChange={setStore}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No store set</SelectItem>
            {storeOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Radix's Select doesn't submit as a native form field — mirror
            the selected value into a hidden input, same pattern used for
            the cycle picker in SubscriptionForm.tsx/PolicyList.tsx. */}
        <input type="hidden" name="store" value={store === '__none__' ? '' : store} />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-ink py-2 font-sans text-[13px] font-medium text-surface disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-none border border-control-border px-3.5 font-sans text-[13px] font-medium text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ShoppingLists({
  lists,
  storeOptions,
}: {
  lists: ListWithItems[];
  storeOptions: string[];
}) {
  const [activeListId, setActiveListId] = useState(lists[0]?.id ?? '');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  function addItem(listId: string) {
    const name = draft.trim();
    if (!name) return;
    const formData = new FormData();
    formData.set('name', name);
    setDraft('');
    startTransition(() => {
      void addItemAction(listId, formData);
    });
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

  return (
    <Tabs value={activeListId} onValueChange={setActiveListId}>
      <TabsList>
        {lists.map((list) => (
          <TabsTrigger key={list.id} value={list.id}>
            {list.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {lists.map((list) => (
        <TabsContent key={list.id} value={list.id}>
          {list.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
              <p className="text-base text-ink">Nothing on this list yet. Add the first item you need.</p>
            </div>
          ) : (
            list.items.map((item) => (
              <div key={item.id} className="border-b border-rule py-3.5">
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      toggleChecked(item.id);
                    }}
                    disabled={isPending}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    <span
                      className={`mt-0.5 h-4 w-4 flex-none border border-control-border ${
                        item.checked ? 'bg-ink' : 'bg-transparent'
                      }`}
                    />
                    <span className={item.checked ? 'flex-1 opacity-55' : 'flex-1'}>
                      <span
                        className={`block font-sans text-[15px] text-ink ${
                          item.checked ? 'line-through' : ''
                        }`}
                      >
                        {item.name}
                        {item.quantity > 1 && (
                          <span className="ml-1.5 font-mono text-[11px] text-ink-muted">
                            ×{item.quantity}
                          </span>
                        )}
                      </span>
                      <span className="block font-mono text-[11px] text-ink-muted uppercase">
                        {item.store ?? 'No store set'}
                      </span>
                      {item.notes && (
                        <span className="mt-0.5 block text-[12px] text-ink-muted">{item.notes}</span>
                      )}
                    </span>
                  </button>
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

                {editingItemId === item.id && (
                  <EditPanel
                    item={item}
                    storeOptions={storeOptions}
                    onDone={() => {
                      setEditingItemId(null);
                    }}
                  />
                )}
              </div>
            ))
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
              disabled={!draft.trim() || isPending}
              className="flex-none border border-control-border px-3 py-1.5 font-sans text-xs font-medium text-ink disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <p className="pt-2 pl-[26px] text-[11px] leading-relaxed text-ink-muted">
            New items land with quantity 1 and no store set. Use the pencil to set details.
          </p>
        </TabsContent>
      ))}
    </Tabs>
  );
}
