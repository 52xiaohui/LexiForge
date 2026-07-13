# Current Progress

[Docs](../README.md)

## Stage

```text
Stage: MVP private pilot
Date: 2026-07-10
Status: Hardening shipped; pilot validation in progress
```

Goal: verify the main learning loop on a real deployment (sync → select →
generate → read → feedback → better selection), fix path-critical friction, and
only promote new scope after lived-in usage notes.

## Execution Queue

Work proceeds in this order.

### Wave 0 — Ship and validate

1. [x] P0/P1 pilot hardening (access token, rate limits, preview, reco v2, telemetry, CI)
2. [x] Push commits; GitHub CI green (backend + frontend; image workflow separately green)
3. [ ] Deploy private pilot (Postgres + API + static FE + env secrets)
4. [ ] Hand-run golden path checklist and file friction notes

Golden path checklist:

```text
AccessGate unlock (good/bad token)
First MaiMemo sync → dashboard / first-run
Weak filter → select → generate (preview matches outcome)
Read → recognize / fail / master / ignore → next preview order changes
Low-coverage banner → regenerate reuses snapshot
Double-click generate/sync → rate limit readable
Export Markdown + soft delete
```

### Wave 1 — Path-critical engineering

5. [x] Article detail embeds per-target learning signals (no full `listWords` fetch)
6. [ ] Article list pagination (drop hard `page_size=100` ceiling on history/dashboard)
7. [x] Detail `created_at` always from API; removed list-scan fallback
8. [ ] 1–2 weeks of real use: validate recommendation v2 is *perceivable*
9. [ ] Optional: generation-runs ops view or curl/script for token cost anxiety

### Wave 2 — After pilot evidence only

10. [ ] From friction notes, promote **at most one** item from `ideas/future.md`
11. [ ] Explicitly defer: multi-user auth, Redis async jobs, full SRS, exam mode

## Validation Notes

Latest local diagnostic run (hardening baseline):

```text
backend: Go go test ./... against isolated PostgreSQL 17
backend: go vet ./...
frontend: tsc --noEmit
frontend: eslint .
frontend: vitest run
frontend: vite build
```

Repeat before each deployment:

```bash
# backend/
go test ./...
go vet ./...

# frontend/
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```

## Pilot friction log

Capture raw notes here (or link out). Do not invent product features from theory.

```text
(date) —
```
