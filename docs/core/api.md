# API

[Previous: data-model](data-model.md) · [Docs](../README.md) · [Next: ai-workflow](ai-workflow.md)

All endpoints are under:

```text
/api/v1
```

Production requests require:

```http
Authorization: Bearer <APP_ACCESS_TOKEN>
```

`GET /session` verifies the token. Development stays open when
`APP_ACCESS_TOKEN` is empty. CORS is not authentication.

## MVP Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/session` | Verify the single-user access token |
| `POST` | `/sync/maimemo` | Sync MaiMemo records synchronously |
| `GET` | `/sync/latest` | Latest sync summary |
| `GET` | `/vocab/records` | Paginated vocab records |
| `GET` | `/vocab/weak` | Paginated weak words |
| `GET` | `/vocab/summary` | Vocab totals |
| `GET` | `/vocab/:id` | One vocab record |
| `PUT` | `/vocab/:id/preferences` | Ignored/pinned preferences |
| `POST` | `/word-events` | Record word learning event |
| `POST` | `/articles/generate` | Generate and save article |
| `POST` | `/articles/preview` | Preview the exact recommendation-selected targets |
| `POST` | `/articles/:id/regenerate` | Regenerate from stored generation params |
| `GET` | `/articles` | Article list, including current user's progress status |
| `GET` | `/articles/:id` | Article detail |
| `DELETE` | `/articles/:id` | Soft delete article |
| `GET` | `/articles/:id/export.md` | Backend Markdown export |
| `GET` | `/articles/:id/progress` | Read article progress |
| `PUT` | `/articles/:id/progress` | Update article progress |
| `GET` | `/articles/generation-runs` | Inspect recent AI attempts, latency, tokens, and failures |

## Sync

```text
POST /sync/maimemo
GET  /sync/latest
```

MVP sync is blocking and returns:

```json
{
  "status": "succeeded",
  "records_total": 1079,
  "records_fetched": 1079,
  "records_inserted": 12,
  "records_updated": 1067,
  "duration_ms": 1840,
  "records_unavailable": 0,
  "warning": ""
}
```

If `MAIMEMO_TOKEN` is missing:

```json
{
  "code": "MAIMEMO_TOKEN_MISSING",
  "message": "MAIMEMO_TOKEN is not configured."
}
```

## Vocab

```text
GET /vocab/records
GET /vocab/weak
GET /vocab/summary
GET /vocab/:id
```

Query params:

```text
page
page_size
search
last_response
tag
min_weak_score
mastery_tier
sort
```

Paged response:

```json
{
  "items": [],
  "total": 233,
  "page": 1,
  "page_size": 50
}
```

## Preferences

```text
PUT /vocab/:id/preferences
```

Request:

```json
{
  "ignored": true,
  "ignored_reason": "not_relevant",
  "ignored_until": null,
  "pinned": false
}
```

Ignored words do not enter automatic generation pools. This does not mean the word is mastered.

## Word Events

```text
POST /word-events
```

Request:

```json
{
  "word_id": "uuid",
  "article_id": "uuid",
  "event_type": "recognized_in_context",
  "source": "reader",
  "metadata": {
    "paragraph_index": 3
  }
}
```

MVP `event_type` values:

```text
recognized_in_context
failed_in_context
manually_mastered
exposed_in_article
```

## Article Generation

```text
POST /articles/preview
```

Preview request:

```json
{
  "target_word_count": 30,
  "target_word_ids": ["study-record-uuid"]
}
```

The response is produced by the same `recommendation v2` selector used by
generation. Every word includes `recommendation_score`,
`recommendation_version`, and `recommendation_reasons`; the frontend does not
approximate the selection locally.

```text
POST /articles/generate
```

Request:

```json
{
  "topic": "campus life",
  "difficulty": "B1",
  "article_length": "medium",
  "target_word_count": 30,
  "target_word_ids": ["study-record-uuid"]
}
```

Rules:

```text
15 <= target_word_count <= 80
len(target_word_ids) <= target_word_count
len(target_word_ids) <= 80
```

Response:

```json
{
  "article_id": "uuid",
  "status": "succeeded",
  "covered_word_count": 29,
  "target_word_count": 30,
  "coverage_rate": 0.9667
}
```

Every generation creates a new `articles` row and new `article_words` rows. Regeneration reuses the previous article's `generation_params` and creates another article.

Generate and regenerate share a process-local per-minute budget. Exceeding it
returns `429 RATE_LIMITED` with `Retry-After`.

```text
POST /articles/:id/regenerate
```

The backend reads the source article's `generation_params`, reuses the stored `target_record_ids`, and creates a new article. The old article remains unchanged.

```text
GET /articles/generation-runs?limit=20
```

Returns the latest generation operations, including failed runs. Fields include
`status`, `attempt_count`, `duration_ms`, `input_tokens`, `output_tokens`,
`coverage_rate`, `model_name`, and a non-sensitive `error_code`.

## Article Detail

```text
GET /articles
```

List items include the current user's reading progress when it exists:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "...",
      "topic": "...",
      "difficulty": "B1",
      "article_length": "medium",
      "target_word_count": 30,
      "covered_word_count": 29,
      "coverage_rate": 0.9667,
      "progress_status": "reading",
      "progress_percent": 45,
      "last_paragraph_index": 6
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50
}
```

```text
GET /articles/:id
```

Response shape:

```json
{
  "article": {
    "id": "uuid",
    "title": "...",
    "topic": "...",
    "difficulty": "B1",
    "article_length": "medium",
    "content_markdown": "...",
    "target_word_count": 30,
    "covered_word_count": 29,
    "coverage_rate": 0.9667,
    "generation_params": {},
    "created_at": "2026-07-10T12:00:00Z"
  },
  "words": [
    {
      "word_id": "uuid",
      "spelling": "stoic",
      "translation": "...",
      "char_offset": 12,
      "char_length": 5,
      "is_covered": true,
      "study_record_id": "uuid",
      "last_response": "VAGUE",
      "study_count": 4,
      "mastery_score": 42,
      "weak_score": 88,
      "recognized": false,
      "mastered": false,
      "ignored": false
    }
  ]
}
```

Each target word includes optional per-user learning signals joined from
`study_records`, preferences, and recent word events so the reader UI does not
need a full vocabulary index fetch. `created_at` is always present on the
article object.

## Article Progress

```text
GET /articles/:id/progress
PUT /articles/:id/progress
```

Update request:

```json
{
  "status": "reading",
  "progress_percent": 45,
  "last_paragraph_index": 6
}
```

When status first changes to `read`, the backend creates one
`exposed_in_article` event for each covered target word in the article. Repeated
`read` updates do not duplicate those exposure events.

## Later Endpoints

v0.5:

```text
auth/register, login, logout, me
integrations/maimemo/token
sync/jobs/:id
imports/vocab.csv
imports/anki.apkg
```

v1:

```text
articles/:id/exercises
exercises/:id/attempts
exercise-attempts
review queue / SRS endpoints
```
