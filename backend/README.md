# LexiForge Backend

Go + Gin + GORM + PostgreSQL backend for LexiForge / Memo-Skills, scaffolded
per `docs/02-architecture.md`. MVP scope: single-user, MaiMemo sync, AI
article generation, coverage tracking. v0.5+ topics (auth, encryption,
limits, async jobs, imports) are intentionally absent.

The MVP backend core is implemented: MaiMemo sync pulls single-user records,
scores them, upserts `vocab_words` / `study_records`, exposes vocab query
endpoints, generates AI articles, persists coverage metadata, and exports
article Markdown.

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
# {"status":"succeeded","records_total":992,"records_inserted":992,"records_updated":0,"duration_ms":1840}

curl http://localhost:8080/api/v1/vocab/weak?min_weak_score=80
# {"items":[...],"total":233,"page":1,"page_size":50}

curl -X POST http://localhost:8080/api/v1/articles/generate \
  -H "Content-Type: application/json" \
  -d '{"topic":"campus life","difficulty":"B1-B2","target_word_count":30,"article_length":"medium"}'
# {"article_id":"...","status":"succeeded","covered_word_count":29,"target_word_count":30,"coverage_rate":0.9667}
```

## Tests

```bash
go test ./...
```

Postgres integration tests are opt-in so the default test suite does not
require Docker or a local database. To run them, provide an isolated test
database URL:

```bash
LEXIFORGE_TEST_DATABASE_URL="postgres://lexiforge:lexiforge@localhost:5432/lexiforge?sslmode=disable" go test ./internal/database
```

The integration tests create and drop a random schema inside that database.

## Environment

| Variable | Required | Default | Notes |
|---|---|---|---|
| `APP_ENV` | no | `development` | `production` switches Gin to release mode and slog to JSON |
| `APP_PORT` | no | `8080` | leading `:` optional |
| `DATABASE_URL` | yes | dev default | Postgres DSN |
| `LOG_LEVEL` | no | `info` | debug / info / warn / error |
| `MAIMEMO_TOKEN` | no | — | MVP single-user MaiMemo token |
| `OPENAI_API_KEY` | no | — | required for article generation |
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
    maimemo/                     MaiMemo client + sync handler/service/repo
    ai/                          OpenAI-compatible article generation client
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
- Broader integration tests for sync and API handler flows
- Frontend MVP screens for sync, vocabulary, and article generation

v0.5 picks up auth, AES-GCM token storage, Redis-backed limits, async sync
jobs, and CSV/Anki imports.
