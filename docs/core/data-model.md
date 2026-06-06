# Data Model

[Previous: architecture](architecture.md) · [Docs](../README.md) · [Next: api](api.md)

## MVP Tables

MVP schema is intentionally small but preserves correct semantics for future migration into a full vocabulary product.

```text
users
vocab_words
study_records
articles
article_words
user_word_preferences
word_learning_events
user_article_progress
```

## Learning Modes

`users.learning_mode`:

```text
external_assist     external app remains the source of truth
lexiforge_primary   LexiForge becomes the source of truth
```

MVP seeds one local user:

```text
id              00000000-0000-0000-0000-000000000001
email           local@localhost
password_hash   ''
learning_mode   external_assist
```

## Vocabulary Source Data

`vocab_words` stores word identity:

```text
id
provider
provider_voc_id
spelling
created_at
updated_at
unique(provider, provider_voc_id)
```

`study_records` stores user-specific learning state imported or synced from a provider:

```text
id
user_id
word_id
provider
provider_voc_id
last_response
study_count
tags jsonb
add_date
first_study_date
last_study_date
next_study_date
mastery_score
weak_score
score_version
score_reasons jsonb
last_scored_at
raw_payload jsonb
synced_at
unique(user_id, provider, provider_voc_id)
```

`study_records` should mirror external facts. Local LexiForge actions should not overwrite external facts.

## Local Product Signals

`user_word_preferences` stores recommendation preferences, not learning results:

```text
id
user_id
word_id
ignored boolean
ignored_reason nullable
ignored_until nullable
pinned boolean
unique(user_id, word_id)
```

Rules:

- Ignored words do not enter automatic generation pools.
- Ignored does not mean mastered.
- Ignored should not zero out `weak_score`.

`word_learning_events` stores word-level actions inside LexiForge:

```text
id
user_id
word_id
article_id nullable
event_type
source
metadata jsonb
created_at
```

MVP event types:

```text
recognized_in_context
failed_in_context
manually_mastered
exposed_in_article
```

Later review event types can be added without changing the table shape:

```text
card_correct
card_wrong
review_scheduled
review_skipped
```

`user_article_progress` stores reading state:

```text
id
user_id
article_id
status              unread | reading | read
progress_percent
last_paragraph_index
started_at
completed_at
unique(user_id, article_id)
```

Reading an article can create `exposed_in_article` events, but exposure is not mastery.

## Articles

`articles` stores generated content and reproducible generation parameters:

```text
id
user_id
title
topic
difficulty
article_length       short | medium | long
content_markdown
summary
generation_params jsonb
target_word_count
covered_word_count
coverage_rate
generation_status    succeeded | low_coverage | failed
model_name
prompt_version
created_at
updated_at
deleted_at nullable
```

`generation_params` should include:

```json
{
  "topic": "campus life",
  "difficulty": "B1",
  "article_length": "medium",
  "target_word_count": 30,
  "target_record_ids": ["..."],
  "target_word_ids": ["..."],
  "selection_mode": "manual"
}
```

`article_words` stores every target word, covered or not:

```text
id
article_id
word_id
spelling
form nullable
occurrence nullable
context_before nullable
context_after nullable
char_offset nullable   Unicode code point offset
char_length nullable   Unicode code point length
is_covered
created_at
unique(article_id, word_id)
```

Covered words have offsets. Missing target words still get a row with `is_covered=false`.

## Scoring

`mastery_score` is 0-100. Initial v1 rules:

```text
WELL_FAMILIAR  95
FAMILIAR       75
VAGUE          45
FORGET         20
UNKNOWN        50
```

Modifiers:

```text
STICKING tag                         -25 mastery, +50 weak
study_count >= 10 and FORGET          -10 mastery
next_study_date <= today              -5 mastery, +20 weak
next_study_date within 7 days         +10 weak
next_study_date >= today + 30 days    +5 mastery
```

`weak_score` initial weights:

```text
FORGET        +100
VAGUE          +80
FAMILIAR       +20
WELL_FAMILIAR  -30
STICKING       +50
study_count    +min(study_count, 30)
```

MVP can record `word_learning_events` without feeding them into scoring yet. When events start affecting scores, bump `score_version`.

## Selection

Initial article target selection:

```text
manual selected words first
then fill remaining slots from weak pool
ignore user_word_preferences.ignored=true
avoid duplicate word_id in one article
```

Suggested mix for automatic fill:

```text
70% high weak_score
20% medium mastery
10% recently studied
```

Article count limits:

```text
short   15-25 target words
medium  26-40 target words
long    41-80 target words
```
