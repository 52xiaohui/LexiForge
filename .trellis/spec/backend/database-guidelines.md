# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

The backend uses GORM with PostgreSQL. MVP migrations run through
`database.RunMigrations`, which enables `pgcrypto`, runs `AutoMigrate`, and
seeds the fixed `user.LocalUserID` row.

---

## Scenario: MVP MaiMemo Vocabulary Sync

### 1. Scope / Trigger

- Trigger: implementing `POST /api/v1/sync/maimemo` and vocabulary query APIs.
- This is a cross-layer contract: MaiMemo API -> service scoring -> GORM upsert -> REST query response.

### 2. Signatures

- API:
  - `POST /api/v1/sync/maimemo`
  - `GET /api/v1/sync/latest`
  - `GET /api/v1/vocab/records`
  - `GET /api/v1/vocab/weak`
  - `GET /api/v1/vocab/summary`
  - `GET /api/v1/vocab/:id`
- DB:
  - `vocab_words.unique(provider, provider_voc_id)`
  - `study_records.unique(user_id, provider, provider_voc_id)`
  - `study_records.word_id -> vocab_words.id`
  - `study_records.user_id -> users.id`

### 3. Contracts

- Environment:
  - `MAIMEMO_TOKEN` is read from config and used only in memory for MVP sync.
- Stored record contract:
  - provider is `maimemo`.
  - `provider_voc_id` is upstream `voc_id`.
  - empty or unknown `last_response` is normalized to `UNKNOWN`.
  - `score_version` is `v1`.
  - `score_reasons` is JSONB with integer reason contributions.
  - `synced_at` is set on every sync write.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| `MAIMEMO_TOKEN` missing | `400 MAIMEMO_TOKEN_MISSING` |
| MaiMemo returns 401/403 | `401 MAIMEMO_TOKEN_INVALID` |
| MaiMemo unavailable / non-2xx | `502 MAIMEMO_API_UNAVAILABLE` |
| Upstream record missing `voc_id` or `voc_spelling` | fail sync; do not partially write silently |
| Invalid vocab query integer | `400 INVALID_QUERY` |
| Vocab record id is not a UUID | `400 INVALID_QUERY` |
| Local-user vocab record not found | `404 VOCAB_RECORD_NOT_FOUND` |

### 5. Good/Base/Bad Cases

- Good: sync 992 records twice; second run updates existing rows and does not duplicate words or study records.
- Base: empty upstream records list returns succeeded with zero inserted/updated.
- Bad: missing `MAIMEMO_TOKEN` returns a JSON error without calling the client.

### 6. Tests Required

- Scoring tests assert mastery/weak score and reason keys for `FORGET`, `STICKING`, due dates, and future dates.
- Client tests assert method/path/body and Authorization header behavior without logging the token.
- Service tests assert upstream records are mapped to provider keys, scored, and debounced for 5 seconds.
- Handler tests assert shared error envelopes for invalid query and missing token cases.

### 7. Wrong vs Correct

#### Wrong

```go
// Struct updates skip nil pointer fields, so stale dates can survive.
db.Model(&existing).Updates(recordStruct)
```

#### Correct

```go
updates := map[string]any{
	"next_study_date": record.NextStudyDate,
	"last_study_date": record.LastStudyDate,
}
db.Model(&existing).Updates(updates)
```

Use map updates when nullable columns must be overwritten by null values.

---

## Query Patterns

- Handlers must not query GORM directly. Use handler -> service -> repository.
- MaiMemo MVP sync may use per-record upserts because the documented MVP data size is about 1000 records.
- Sync must update existing `study_records` rather than insert duplicates.
- Tags and score reasons are stored as JSONB. Query tags with JSON containment, for example `tags @> '["STICKING"]'::jsonb`.

---

## Migrations

- MVP uses GORM `AutoMigrate` at boot. Do not introduce external migration tools until the project decides to replace this boot-time flow.
- UUID defaults depend on PostgreSQL `pgcrypto.gen_random_uuid()`. Keep `CREATE EXTENSION IF NOT EXISTS pgcrypto` before `AutoMigrate`.

---

## Naming Conventions

- Table names are pinned with `TableName()` when drift would be costly.
- Unique indexes use descriptive names, for example `uq_study_records_user_provider_voc`.
- JSON response field names should match documented snake_case DB concepts unless a service DTO intentionally reshapes them.

---

## Common Mistakes

- Do not silently skip malformed upstream records during sync. Failing the sync is easier to debug than hiding partial data loss.
- Do not log `MAIMEMO_TOKEN` or Authorization values when investigating sync failures.
