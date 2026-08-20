import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set.');
}

const client = postgres(databaseUrl);

export const db = drizzle(client, { schema });

/**
 * Either the module-level `db` singleton or a transaction handle from
 * `db.transaction(...)`. Query functions in `db/queries/` accept this
 * (defaulting to `db`) so integration tests can pass a transaction and
 * observe uncommitted rows within it — `db` itself is a separate
 * connection and wouldn't see them. See tests/integration/db.test.ts for
 * the rollback pattern this exists to support.
 */
export type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];