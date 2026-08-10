import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { phase0Healthcheck } from '@/server/db/schema';

describe('database connectivity', () => {
  it('writes and reads a row against the real Postgres instance, then rolls back', async () => {
    // TESTING.md: "Each test runs in a transaction rolled back afterwards" —
    // tx.rollback() throws internally, which is what makes db.transaction()
    // reject here. The rejection is the expected, successful outcome.
    await expect(
      db.transaction(async (tx) => {
        const [inserted] = await tx.insert(phase0Healthcheck).values({}).returning();
        if (!inserted) {
          throw new Error('Insert did not return a row');
        }

        const [found] = await tx
          .select()
          .from(phase0Healthcheck)
          .where(eq(phase0Healthcheck.id, inserted.id));
        expect(found?.id).toBe(inserted.id);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
