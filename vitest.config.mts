import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Integration tests need DATABASE_URL; Vitest doesn't load .env.local on its
// own the way Next.js's runtime does.
config({ path: '.env.local' });

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Next.js's webpack resolver swaps `server-only` for a no-op in a
      // server context; Vitest needs the same swap done explicitly, or
      // any server-only module throws the moment a test imports it.
      'server-only': fileURLToPath(new URL('./tests/mocks/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
