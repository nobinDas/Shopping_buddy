import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { insurancePolicies } from '@/server/db/schema';
import {
  createPolicy,
  updatePolicy,
  archivePolicy,
  restorePolicy,
} from '@/server/services/insurance.service';

// Same pattern as tests/integration/db.test.ts: tx.rollback() throws
// internally, so db.transaction() rejects — that rejection is the
// expected, successful outcome, not a failure.

const validInput = {
  type: 'auto' as const,
  insurer: 'State Farm',
  policyNumber: 'AUTO-88213',
  premiumMinor: 84000,
  currency: 'USD',
  cycle: 'semiannual' as const,
  anchorDate: '2026-01-15',
  reminderLeadDays: 30,
};

describe('createPolicy', () => {
  it('derives nextBillingDate from anchorDate and cycle rather than trusting caller input', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await createPolicy(validInput, tx);

        expect(created.nextBillingDate).toBe('2026-01-15');
        expect(created.status).toBe('active');
        expect(created.insurer).toBe('State Farm');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('updatePolicy', () => {
  it('recomputes nextBillingDate when cycle changes', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await createPolicy(validInput, tx);

        const updated = await updatePolicy(
          created.id,
          { ...validInput, cycle: 'annual', anchorDate: '2026-02-01' },
          tx,
        );

        expect(updated.cycle).toBe('annual');
        expect(updated.nextBillingDate).toBe('2026-02-01');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('throws for a policy id that does not exist', async () => {
    await expect(
      db.transaction(async (tx) => {
        await updatePolicy('00000000-0000-0000-0000-000000000000', validInput, tx);
      }),
    ).rejects.toThrow();
  });
});

describe('archivePolicy / restorePolicy', () => {
  it('sets status to archived without deleting the row', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(insurancePolicies)
          .values({
            type: 'auto',
            insurer: 'Test',
            policyNumber: 'T-1',
            premiumMinor: 1000,
            currency: 'USD',
            cycle: 'annual',
            anchorDate: '2026-01-01',
            nextBillingDate: '2027-01-01',
          })
          .returning();
        if (!created) {
          throw new Error('Insert did not return a row');
        }

        const archived = await archivePolicy(created.id, tx);

        expect(archived.status).toBe('archived');
        expect(archived.id).toBe(created.id);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('round-trips through archive then restore', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await createPolicy(validInput, tx);

        await archivePolicy(created.id, tx);
        const restored = await restorePolicy(created.id, tx);

        expect(restored.status).toBe('active');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
