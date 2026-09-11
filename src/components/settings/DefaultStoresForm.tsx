'use client';

import { useState, useTransition } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ShoppingListRow } from '@/server/db/queries/shopping';
import { setListDefaultStoreAction } from '@/app/(dashboard)/settings/actions';

const NONE = '__none__';

function DefaultStoreRow({
  list,
  storeOptions,
}: {
  list: ShoppingListRow;
  storeOptions: string[];
}) {
  const [value, setValue] = useState(list.defaultStore ?? NONE);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule py-3">
      <span className="font-sans text-sm text-ink">{list.name}</span>
      <Select
        value={value}
        disabled={isPending}
        onValueChange={(next) => {
          setValue(next);
          startTransition(() => {
            void setListDefaultStoreAction(list.id, next === NONE ? '' : next);
          });
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No default store</SelectItem>
          {storeOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DefaultStoresForm({
  lists,
  storeOptions,
}: {
  lists: ShoppingListRow[];
  storeOptions: string[];
}) {
  return (
    <div className="border-t border-rule">
      {lists.map((list) => (
        <DefaultStoreRow key={list.id} list={list} storeOptions={storeOptions} />
      ))}
    </div>
  );
}
