import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // domain/ must stay pure — no I/O. See docs/ARCHITECTURE.md "Layers".
    files: ['src/server/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // covers both the '@/server/...' alias and relative siblings
              // ('../services/...') — domain/ sits inside server/, so a
              // relative sibling import never contains the literal 'server'
              // segment the alias form does.
              group: [
                '**/server/services/**',
                '**/server/providers/**',
                '**/server/db/**',
                '../services/**',
                '../providers/**',
                '../db/**',
              ],
              message: 'domain/ is pure — no I/O. Move this call into services/ and pass data in instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // src/lib is shared and client-safe. See docs/ARCHITECTURE.md boundaries table.
    files: ['src/lib/**/*.ts', 'src/lib/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**'],
              message: 'src/lib is client-safe; importing src/server/** here risks shipping secrets to the browser. See docs/SECURITY.md.',
            },
          ],
        },
      ],
    },
  },
);

// NOTE: the ARCHITECTURE.md rule "client components never import src/server/**"
// isn't enforced yet — it depends on Next.js's 'use client' directive, which
// doesn't exist until the app is scaffolded (Phase 0.2). Add it then.
