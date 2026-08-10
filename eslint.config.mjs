import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextConfig from 'eslint-config-next';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      // plain-JS config files (eslint.config.mjs, postcss.config.mjs, ...) —
      // the typed typescript-eslint rules below apply globally and need
      // parserOptions.project/projectService, which these files don't have.
      '*.config.mjs',
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
  // eslint-config-next comes before our own typescript-eslint configs so
  // our stricter typed rules and parserOptions win where they overlap.
  ...nextConfig,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
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
              message:
                'domain/ is pure — no I/O. Move this call into services/ and pass data in instead.',
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
              message:
                'src/lib is client-safe; importing src/server/** here risks shipping secrets to the browser. See docs/SECURITY.md.',
            },
          ],
        },
      ],
    },
  },
  // Must be last: turns off any ESLint rule that fights Prettier's formatting.
  eslintConfigPrettier,
);

// NOTE: the ARCHITECTURE.md rule "client components never import src/server/**"
// is enforced at build time, not lint time, starting with
// src/server/providers/supabase.ts: it imports 'server-only', which throws a
// build error the moment that module ends up in a client bundle. Add the same
// import to every new file under src/server/ as it gains real code — ESLint
// still can't key off the 'use client' directive itself (no-restricted-imports
// only matches file paths/globs), so this is the actual enforcement mechanism.
