# LexiForge Backend

Go + Gin + GORM + PostgreSQL backend for LexiForge / Memo-Skills, scaffolded
per `docs/02-architecture.md`. MVP scope: single-user, MaiMemo sync, AI
article generation, coverage tracking. v0.5+ topics (auth, encryption,
limits, async jobs, imports) are intentionally absent.

This repo is currently a **skeleton** — every MVP REST endpoint is registered
but returns `501 NOT_IMPLEMENTED`. The directory layout, DB schema, middleware
and external clients are in place so business logic can drop in package by
package.

## Quick start (local Go)

```bash
# 1. start Postgres however you prefer (e.g. compose)
docker compose up -d postgres

# 2. copy env
cp ../.env.example ../.env

# 3. run the server
go run ./cmd/server
```

## Quick start (full stack with compose)

From the repo root:

```bash
cp .env.example .env
docker compose up -d --build

curl http://localhost:8080/healthz
# {"status":"ok"}

curl -X POST http://localhost:8080/api/v1/sync/maimemo
# {"code":"NOT_IMPLEMENTED","message":"POST /sync/maimemo pending"}
```

## Environment

| Variable | Required | Default | Notes |
|---|---|---|---|
| `APP_ENV` | no | `development` | `production` switches Gin to release mode and slog to JSON |
| `APP_PORT` | no | `8080` | leading `:` optional |
| `DATABASE_URL` | yes | dev default | Postgres DSN |
| `LOG_LEVEL` | no | `info` | debug / info / warn / error |
| `MAIMEMO_TOKEN` | no | — | MVP single-user MaiMemo token |
| `OPENAI_API_KEY` | no | — | empty until article generation lands |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` | OpenAI-compatible endpoints |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | overrideable per request later |

## Layout

```
backend/
  cmd/server/main.go             entrypoint: load → migrate → seed → serve
  internal/
    config/                      env-driven runtime config
    database/                    gorm open + AutoMigrate + seed local-user
    httpx/                       {code,message,details} response helper
    middleware/                  cors, structured logger (redacted), recover
    user/                        User model + LocalUserID constant
    vocabulary/                  VocabWord, StudyRecord + handler/service/repo
    article/                     Article, ArticleWord + handler/service/repo
    maimemo/                     Client interface + types + sync handler stub
    ai/                          OpenAI-compatible client stub
    export/                      v0.5+ export skeleton (empty in MVP)
  Dockerfile                     multi-stage static build
```

DB tables created by AutoMigrate: `users`, `vocab_words`, `study_records`,
`articles`, `article_words`. The `users` table is seeded with a fixed-UUID
local-user row (`00000000-0000-0000-0000-000000000001`) on every boot.

## Conventions

- Three-layer pattern per domain: `handler.go` (Gin) → `service.go` (logic) →
  `repository.go` (GORM). Keep handlers thin; never import `gorm` from
  handlers.
- Error responses always go through `httpx.Respond` so the wire format stays
  `{code, message, details?}`.
- Logging is `log/slog` with redaction in `middleware/redact.go`. Never log
  Authorization, Cookie, X-API-Key, or query values for `token`, `api_key`,
  `apikey`, `access_token`.
- UUID primary keys via `pgcrypto.gen_random_uuid()`. `pgcrypto` is enabled
  on every boot by `database.RunMigrations`.

## What's not here yet

Roughly in priority order:
- Real `MaiMemo` HTTP client (replace `ErrNotImplemented`)
- Sync service: pull → score (`mastery_score`, `weak_score`) → upsert
- AI article generation + coverage location (see `docs/05-ai-workflow.md`)
- Markdown export
- Tests

v0.5 picks up auth, AES-GCM token storage, Redis-backed limits, async sync
jobs, and CSV/Anki imports.
