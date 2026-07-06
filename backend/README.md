# LexiForge Backend

Go + Gin + GORM + PostgreSQL backend for LexiForge. MVP scope: single-user,
MaiMemo sync, vocabulary scoring, AI article generation, reading progress,
local word-learning events, dictionary lookup, and Markdown export. v0.5+
topics such as auth, encrypted third-party token storage, limits, async jobs,
and user-managed imports are intentionally absent.

The MVP backend core is implemented: MaiMemo sync pulls single-user records,
scores them, upserts `vocab_words` / `study_records`, exposes vocab query
endpoints, generates AI articles, persists coverage metadata and generation
parameters, records local reader events, tracks article progress, and exports
article Markdown.

## Quick start (local Go)

From the repo root:

```powershell
# 1. Copy env and edit secrets/database URL if needed.
Copy-Item .env.example .env

# 2. Create the default local database/user once.
#    If they already exist, keep the existing ones.
psql -U postgres -c "CREATE ROLE lexiforge LOGIN PASSWORD 'lexiforge';"
psql -U postgres -c "CREATE DATABASE lexiforge OWNER lexiforge;"

# 3. Run the server.
Set-Location backend
go run ./cmd/server
```

Then verify the server from another terminal:

```powershell
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
require a local database. To run them, provide an isolated test database URL:

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
| `CORS_ALLOWED_ORIGINS` | no | — | comma-separated browser origins allowed to call the API; `*` allows any browser origin |
| `MAIMEMO_TOKEN` | no | — | MVP single-user MaiMemo token |
| `OPENAI_API_KEY` | no | — | required for article generation |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` | OpenAI-compatible endpoints |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | overrideable per request later |

Runtime config is read from process environment first, then the optional project
root `.env` file. Use Docker / 1Panel environment variables in production; keep
`.env` as the local development fallback.

When `CORS_ALLOWED_ORIGINS=*`, the API reflects the request `Origin` instead of
returning `Access-Control-Allow-Origin: *`, so it remains compatible with the
current credentials header. Prefer exact frontend origins for public production
deployments.

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
    dictionary/                  local dictionary lookup/import support
    vocabulary/                  vocab records, scoring, preferences
    article/                     Article, ArticleWord + handler/service/repo
    learning/                    word learning events
    maimemo/                     MaiMemo client + sync handler/service/repo
    ai/                          OpenAI-compatible article generation client
```

DB tables created by AutoMigrate: `users`, `vocab_words`, `study_records`,
`user_word_preferences`, `dictionary_entries`, `articles`, `article_words`,
`user_article_progress`, and `word_learning_events`. The `users` table is
seeded with a fixed-UUID local-user row
(`00000000-0000-0000-0000-000000000001`) on every boot.

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
- Authentication and multi-user account boundaries
- Encrypted token storage for integrations
- Async sync/generation jobs and rate limits

v0.5 picks up auth, AES-GCM token storage, Redis-backed limits, async sync
jobs, and CSV/Anki imports.
