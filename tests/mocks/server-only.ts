// Next.js's webpack resolver swaps the real `server-only` package (which
// unconditionally throws — see node_modules/server-only/index.js) for a
// no-op in a server context. Vitest runs under plain Node, not webpack, so
// it needs the same swap done explicitly via vitest.config.mts's alias —
// otherwise any server-only module (e.g. providers/crypto.ts,
// providers/supabase.ts) throws the moment a test imports it.
export {};
