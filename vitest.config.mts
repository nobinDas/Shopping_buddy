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
    },
  },
  test: {
    environment: 'node',
  },
});
