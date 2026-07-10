# Frontend

[Previous: ai-workflow](ai-workflow.md) · [Docs](../README.md)

## MVP Routes

```text
/dashboard
/vocab
/vocab/weak
/articles
/articles/new
/articles/:id
```

No registration, account settings, reports, or exercises in MVP. Production
deployments show a single-user access gate; the token is entered at runtime and
kept only in `sessionStorage`.

## Dashboard

Show only real data:

- total words
- weak word count
- latest sync time
- recent articles
- continue reading, from `user_article_progress`
- next weak words

Do not show fake daily progress, streaks, or learning reports until backend events support them.

## Vocab

`/vocab` is a browse surface:

- search
- filter by response or mastery tier
- sort/paginate
- show score and next review date from synced/imported data

## Weak Words

`/vocab/weak` is an action surface:

- filter by `last_response`
- filter `STICKING`
- sort by `weak_score`
- select words for article generation
- ignore a word through `PUT /vocab/:id/preferences`

Important semantics:

```text
ignored != mastered
```

Do not use frontend memory sets as the source of truth for ignored/mastered/recognized/read.

## Article Generation

`/articles/new` supports:

- topic
- CEFR difficulty: A2/B1/B2/C1
- article length: short/medium/long
- target word count
- optional `target_word_ids` from `/vocab/weak`
- a backend-driven preview using the exact same recommendation selector as
  article generation

Validation:

```text
15 <= target_word_count <= 80
selected words <= target_word_count
selected words <= 80
```

If opened with selected words:

```text
N <= 25    default short
26-40      default medium
41-80      default long
```

## Article Detail

`/articles/:id` supports:

- article body
- target word highlight from `article_words.char_offset` and `char_length`
- coverage drawer/list
- missing target words
- backend Markdown export
- regenerate using `generation_params`
- reading progress updates
- word feedback events

State mapping:

```text
read article          -> PUT /articles/:id/progress
recognized word       -> POST /word-events recognized_in_context
failed word           -> POST /word-events failed_in_context
marked mastered       -> POST /word-events manually_mastered
ignored word          -> PUT /vocab/:id/preferences
```

Reading a full article does not mean all target words are mastered.

## Article History

`/articles` supports:

- list generated articles
- show topic, difficulty, article length, coverage, created time
- open article
- soft delete

Article length must come from the backend. The frontend must not infer it from target count.

## UX Boundary

MVP may contain reading aids such as TTS, focus mode, or local layout preferences. Learning state must be persisted through API calls; otherwise the UI must present it as a local-only preference.
