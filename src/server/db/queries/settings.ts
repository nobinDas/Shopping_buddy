import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { userSettings } from '@/server/db/schema';

const SETTINGS_ROW_ID = 'default';

export type UserSettingsRow = typeof userSettings.$inferSelect;

export async function getHomeAddress(client: DbClient = db): Promise<string | null> {
  const [row] = await client
    .select()
    .from(userSettings)
    .where(eq(userSettings.id, SETTINGS_ROW_ID));
  return row?.homeAddress ?? null;
}

/** Upserts the single settings row — a second call updates it, never duplicates it. */
export async function setHomeAddress(address: string, client: DbClient = db): Promise<void> {
  await client
    .insert(userSettings)
    .values({ id: SETTINGS_ROW_ID, homeAddress: address })
    .onConflictDoUpdate({
      target: userSettings.id,
      set: { homeAddress: address, updatedAt: new Date() },
    });
}
