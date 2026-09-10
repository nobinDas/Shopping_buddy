import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { insurancePolicies } from '@/server/db/schema';

export type PolicyRow = typeof insurancePolicies.$inferSelect;
export type NewPolicy = typeof insurancePolicies.$inferInsert;

/** Fetches every policy with status = 'active' — the dashboard's burn/reminder source. */
export async function getActivePolicies(client: DbClient = db): Promise<PolicyRow[]> {
  return client.select().from(insurancePolicies).where(eq(insurancePolicies.status, 'active'));
}

/** Fetches every policy regardless of status — the list view's source. */
export async function getAllPolicies(client: DbClient = db): Promise<PolicyRow[]> {
  return client.select().from(insurancePolicies);
}

export async function getPolicyById(
  id: string,
  client: DbClient = db,
): Promise<PolicyRow | undefined> {
  const [row] = await client.select().from(insurancePolicies).where(eq(insurancePolicies.id, id));
  return row;
}

export async function insertPolicy(values: NewPolicy, client: DbClient = db): Promise<PolicyRow> {
  const [row] = await client.insert(insurancePolicies).values(values).returning();
  if (!row) {
    throw new Error('insertPolicy: insert did not return a row');
  }
  return row;
}

/**
 * Updates arbitrary columns on one policy. No business logic — the
 * services layer decides what changes (recomputing nextBillingDate,
 * flipping status on archive/restore) and passes the final values in.
 */
export async function updatePolicyRow(
  id: string,
  values: Partial<NewPolicy>,
  client: DbClient = db,
): Promise<PolicyRow> {
  const [row] = await client
    .update(insurancePolicies)
    .set(values)
    .where(eq(insurancePolicies.id, id))
    .returning();
  if (!row) {
    throw new Error(`updatePolicyRow: no policy with id ${id}`);
  }
  return row;
}
