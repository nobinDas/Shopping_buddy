import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs as a standalone CLI, outside Next.js's own env loading,
// so it needs its own .env.local read.
config({ path: '.env.local' });

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env.local and fill it in.');
}

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
