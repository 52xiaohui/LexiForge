# Current Progress

[Docs](../README.md)

## Stage

```text
Stage: MVP data foundation stabilization
Date: 2026-06-06
Status: Technical debt pass complete; data foundation stable
```

Goal: keep MVP small, but make data semantics real before implementation continues.

## Execution Queue

Work proceeds in this order.

1. [x] Backend schema/model: add MVP data foundation
   - `users.learning_mode`
   - `articles.article_length`
   - `articles.generation_params`
   - `user_word_preferences`
   - `word_learning_events`
   - `user_article_progress`
2. [x] Backend article generation: persist `article_length` and `generation_params`
3. [x] Backend article regeneration: reuse previous article `generation_params`
4. [x] Backend API: implement `PUT /api/v1/vocab/:id/preferences`
5. [x] Backend API: implement `POST /api/v1/word-events`
6. [x] Backend API: implement `GET/PUT /api/v1/articles/:id/progress`
7. [x] Frontend cleanup: remove local fake learning state from API layer
   - `hiddenWordIds`
   - `recognizedWordIds`
   - `readArticleIds`
8. [x] Frontend weak words: wire ignore/master actions to backend APIs
9. [x] Frontend article detail: wire recognized/failed/mastered/read progress to backend APIs
10. [x] Frontend dashboard/history cleanup
    - remove fake daily progress and streaks
    - use backend Markdown export
    - remove fake `recently_covered_count` or backend-drive it
    - remove outdated “frontend prototype” delete copy
11. [x] Technical debt pass after data foundation
    - fix frontend lint gate
    - persist article `progress_percent` / `last_paragraph_index` from reader
    - create `exposed_in_article` events when an article first becomes read
    - remove stale mock-data business store and mock-only API fields
    - include article progress in article list responses to avoid frontend N+1
    - update backend/frontend README drift

## Validation Notes

Latest diagnostic run:

```text
backend: go test ./... passed after task 11 technical debt pass
frontend: ./node_modules/.bin/tsc --noEmit passed after task 11 technical debt pass
frontend: ./node_modules/.bin/eslint . passed after task 11 technical debt pass
frontend: ./node_modules/.bin/vitest run passed after task 11 technical debt pass
frontend: ./node_modules/.bin/vite build passed after task 11 technical debt pass
```

Before implementation is considered stable:

```bash
go test ./...
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```
