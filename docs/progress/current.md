# Current Progress

[Docs](../README.md)

## Stage

```text
Stage: MVP pilot hardening
Date: 2026-07-10
Status: P0/P1 implementation complete; local validation passed, CI pending publish
```

Goal: make the single-user MVP safe to deploy, close the generation contract,
and let local reading feedback influence future article selection without
overwriting external learning facts.

## Execution Queue

Work proceeds in this order.

1. [x] P0: protect production `/api/v1` with a single-user Bearer token
2. [x] P0: add browser session unlock without embedding the token in Vite output
3. [x] P0: rate-limit AI generation/regeneration and MaiMemo sync
4. [x] P0: route article regeneration through stored target-record snapshots
5. [x] P0: replace frontend preview approximation with `POST /articles/preview`
6. [x] P0: show low-coverage articles explicitly in the reader
7. [x] P0: add backend/frontend CI and gate backend image publication on tests
8. [x] P1: add feedback-aware `recommendation v2`
   - latest contextual failure raises priority
   - recent recognition lowers priority temporarily
   - recent article exposure adds a diversity cooldown
   - pinned words receive a boost
   - ignored and manually mastered words remain hard exclusions
9. [x] P1: persist recommendation version, score, and reasons in generation snapshots
10. [x] P1: persist generation attempts, latency, model, tokens, coverage, and safe errors
11. [x] P1: expose recent telemetry through `GET /articles/generation-runs`
12. [x] Correct `ignored_until` so expired preferences become eligible again

## Validation Notes

Latest local diagnostic run:

```text
backend: Go 1.26.2 go test ./... passed against an isolated PostgreSQL 17 instance
backend: Go 1.26.2 go vet ./... passed
frontend: ./node_modules/.bin/tsc --noEmit passed
frontend: ./node_modules/.bin/eslint . passed
frontend: ./node_modules/.bin/vitest run passed (19 tests)
frontend: ./node_modules/.bin/vite build passed
repo: git diff --check passed
```

GitHub CI provisions PostgreSQL 17 and sets `LEXIFORGE_TEST_DATABASE_URL`, so
the integration suite runs there instead of silently skipping. The backend image
workflow runs the same database-backed test gate before publishing.

Repeat these checks before each deployment:

```bash
go test ./...
go vet ./...
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```
