# LexiForge Frontend

Vite + React + TypeScript SPA for LexiForge. The frontend is a static client:
it renders pages, manages local UI preferences, and talks to the Go backend
through REST APIs under `VITE_API_BASE_URL`.

## Scripts

```bash
./node_modules/.bin/vite --host 0.0.0.0
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```

`pnpm` scripts are defined in `package.json`, but this workspace may not have
`pnpm` on `PATH`; the direct `./node_modules/.bin/*` commands are the reliable
local validation path.

## Environment

```bash
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

If unset, the frontend defaults to `http://localhost:8080/api/v1`.

## Notes

- Runtime learning state comes from the backend. Reader preferences such as
  font size, tone, and challenge mode remain local UI preferences.
- Article reading progress is persisted through
  `GET/PUT /api/v1/articles/:id/progress`.
- The route-level loading/error simulator lives in `src/lib/query-sim.ts` and
  is only for UI state checks; it does not provide business data.
