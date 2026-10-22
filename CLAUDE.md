# Brightpath

Small school app. TypeScript, Hono, SQLite (better-sqlite3), zod, vitest. Node 22.

- Install: `npm ci`
- Check everything before you finish: `npm run typecheck && npm test`
- Run locally: `npm run dev` → http://localhost:3000
- Code: `src/` (`app.ts` routes, `db.ts` data), page: `public/index.html`, tests: `test/`
- New routes get tests in `test/` that call `createApp(openDb(':memory:')).request(...)`.
- Validate request input with zod; return `{ data }` on success and `{ error: CODE }` on failure.
