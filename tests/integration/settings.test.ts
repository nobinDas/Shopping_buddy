import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { getHomeAddress, setHomeAddress } from '@/server/db/queries/settings';

describe('setHomeAddress / getHomeAddress', () => {
  it('is null before anything is set', async () => {
    await expect(
      db.transaction(async (tx) => {
        expect(await getHomeAddress(tx)).toBeNull();
        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('upserts — a second call updates the same row, not a duplicate', async () => {
    await expect(
      db.transaction(async (tx) => {
        await setHomeAddress('1 First St, Testville, TS 00000', tx);
        await setHomeAddress('2 Second St, Testville, TS 00000', tx);

        expect(await getHomeAddress(tx)).toBe('2 Second St, Testville, TS 00000');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
