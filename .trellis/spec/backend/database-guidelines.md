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

---

## Scenario: MVP Article Generation

### 1. Scope / Trigger

- Trigger: implementing `POST /api/v1/articles/generate` and article read/manage/export APIs.
- This is a cross-layer contract: REST request -> vocabulary selection -> OpenAI-compatible JSON output -> coverage validation -> `articles` + `article_words` transaction.

### 2. Signatures

- API:
  - `POST /api/v1/articles/generate`
  - `GET /api/v1/articles`
  - `GET /api/v1/articles/:id`
  - `DELETE /api/v1/articles/:id`
  - `GET /api/v1/articles/:id/export.md`
- DB:
  - `articles.user_id -> users.id`
  - `article_words.article_id -> articles.id`
  - `article_words.word_id -> vocab_words.id`
  - `article_words.unique(article_id, word_id)`

### 3. Contracts

- `target_word_ids` are local-user `study_records.id` values from vocabulary endpoints.
- Every generation request creates a new `articles` row; do not update or regenerate in place.
- Every target word creates exactly one `article_words` row.
- Covered rows set `is_covered=true` and populate `form`, `occurrence`, `context_before`, `context_after`, `char_offset`, and `char_length`.
- Missing rows set `is_covered=false` and leave offset/length fields null.
- `char_offset` and `char_length` are Unicode code point counts, not bytes and not UTF-16 code units.
- The AI client calls `/chat/completions` with `response_format.type=json_schema`; if a provider does not support this, handle that as an AI generation failure rather than parsing free text.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| Invalid JSON | `400 INVALID_JSON` |
| Missing topic | `422 TOPIC_REQUIRED` |
| Missing difficulty | `422 DIFFICULTY_REQUIRED` |
| `target_word_count < 15` | `422 TARGET_WORD_COUNT_TOO_SMALL` |
| `target_word_count > 80` or selected count > 80 | `422 TARGET_WORDS_TOO_MANY` |
| selected count > `target_word_count` | `422 TARGET_WORDS_EXCEED_COUNT` |
| selected id is not UUID | `422 TARGET_WORD_ID_INVALID` |
| selected id not owned by local user | `422 TARGET_WORDS_INVALID` |
| not enough vocab records | `422 TARGET_WORDS_NOT_ENOUGH` |
| `OPENAI_API_KEY` missing | `503 AI_GENERATION_UNAVAILABLE` |
| AI non-2xx or invalid structured JSON | `502 AI_GENERATION_FAILED` |
| article not found | `404 ARTICLE_NOT_FOUND` |

### 5. Good/Base/Bad Cases

- Good: request 30 words with no selected ids; backend fills from weak/mid/recent pools, persists article and 30 article word rows.
- Base: selected ids fewer than `target_word_count`; backend preserves selected words first, then fills remaining slots.
- Bad: AI claims a covered word but verbatim context is not found; treat it as missing and retry if coverage is below 90%.

### 6. Tests Required

- Coverage tests assert Unicode code point offset/length behavior.
- Service tests assert low coverage retries and passes missing words into the next AI call.
- Service tests assert all target words are saved, including missing words.
- Client tests assert OpenAI-compatible request path, Authorization header, and `json_schema` response format.
- Handler tests assert shared error envelopes for invalid JSON and validation failures.

### 7. Wrong vs Correct

#### Wrong

```go
// Do not trust AI-provided positions or plain spelling search.
offset := strings.Index(content, spelling)
```

#### Correct

```go
needle := contextBefore + form + contextAfter
byteStart := strings.Index(content, needle)
charOffset := len([]rune(content[:byteStart+len(contextBefore)]))
charLength := len([]rune(form))
```

Use verbatim context to verify the AI's claim and convert offsets to code point units.
