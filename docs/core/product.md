# Product

[Docs](../README.md) · [Next: architecture](architecture.md)

## Positioning

LexiForge is an AI vocabulary reading tool. It turns a user's vocabulary learning data into targeted English reading material, so weak words appear in coherent context instead of isolated flashcards.

The product has two long-term modes:

| Mode | User situation | LexiForge role |
|---|---|---|
| `external_assist` | User keeps using MaiMemo, Anki, or another app | Contextual reading and review assistant |
| `lexiforge_primary` | User migrates into LexiForge or starts from zero | Main vocabulary, review, reading, and reporting system |

MVP defaults to `external_assist`.

## Core Loop

```text
sync/import vocabulary data
-> calculate mastery_score and weak_score
-> select weak target words
-> generate article
-> read, highlight, export
-> record lightweight feedback events
-> improve future selection
```

## MVP Scope

MVP is single-user and local/demo oriented:

- `MAIMEMO_TOKEN` is configured through environment variables.
- One seeded `local-user` exists in `users`.
- Backend syncs MaiMemo learning records into PostgreSQL.
- Backend calculates `mastery_score` and `weak_score`.
- Frontend shows dashboard, full vocab, weak words, articles, generation page, article detail.
- User can generate an article from auto-selected or manually selected weak words.
- Article target words are stored in `article_words` and highlighted by stable offsets.
- Article generation stores `article_length` and `generation_params` so regeneration can reuse the same target set.
- User preferences and learning signals are persisted through minimal tables:
  - ignored/pinned word preferences
  - word learning events
  - article reading progress
- Markdown export is served by the backend.

MVP explicitly does not include:

- Registration/login
- Token storage UI
- Encrypted user tokens
- Full SRS/review queue
- Full flashcard/back-word feature
- Learning reports, streaks, daily goals
- Reading comprehension or fill-blank exercises
- CSV/Anki import UI
- Payment or quota system

## User Data Boundary

MVP may send the following data to the AI provider:

```text
word
last_response
study_count
tags
topic
difficulty
article_length
```

MVP must not send:

```text
MAIMEMO_TOKEN
passwords
email/phone
raw logs
full third-party authorization headers
```

In `external_assist` mode, LexiForge never claims to modify external app state. "Ignored", "recognized", "mastered", and "read" are local product signals only.
