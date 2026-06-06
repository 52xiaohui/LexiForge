# Decision: MVP Data Foundation

Date: 2026-06-06

## Decision

Change the MVP data model now while the database can be rebuilt.

Do not build the full future learning system yet. Only add the persistent foundations needed to make current UI actions truthful.

## Context

LexiForge needs to support two future modes:

```text
external_assist     user keeps using an external app
lexiforge_primary   user migrates into LexiForge or starts from zero
```

The current prototype has temporary frontend state for:

```text
mastered
ignored
recognized
read
```

Those states are semantically different and should not share one boolean or one frontend memory set.

## Chosen Model

```text
mastered    -> word_learning_events.manually_mastered
ignored     -> user_word_preferences.ignored
recognized  -> word_learning_events.recognized_in_context
read        -> user_article_progress.status
```

Additional article fields:

```text
articles.article_length
articles.generation_params
```

## Consequences

Good:

- Regeneration can reuse the same target word set.
- Ignored words no longer pretend to be mastered.
- Reading and word feedback can later feed scoring.
- External app data remains separate from local product signals.

Costs:

- MVP migrations and API surface grow slightly.
- Some current frontend prototype code must be removed.

## Non-Goals

Not part of this decision:

- Full SRS
- Full review queue
- Learning reports
- Streaks and daily goals
- Full import onboarding
- AI answer grading
