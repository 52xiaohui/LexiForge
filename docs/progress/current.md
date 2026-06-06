# Current Progress

[Docs](../README.md)

## Stage

```text
Stage: MVP data foundation correction
Date: 2026-06-06
Status: docs updated, implementation pending
```

Goal: keep MVP small, but make data semantics real before implementation continues.

## Next Tasks

### P0 Data Model

- [ ] Add `users.learning_mode`
- [ ] Add `articles.article_length`
- [ ] Add `articles.generation_params`
- [ ] Add `user_word_preferences`
- [ ] Add `word_learning_events`
- [ ] Add `user_article_progress`
- [ ] Update Go models, migrations, repositories, services
- [ ] Update tests

### P1 Product Behavior

- [ ] Save final target word snapshot during generation
- [ ] Regenerate using previous `generation_params`
- [ ] Move ignore action to `user_word_preferences`
- [ ] Move recognized/failed/mastered actions to `word_learning_events`
- [ ] Move read/resume state to `user_article_progress`
- [ ] Use backend `/articles/:id/export.md` from frontend
- [ ] Remove fake Dashboard daily progress and streaks

### P2 Cleanup

- [ ] Remove frontend `hiddenWordIds`
- [ ] Remove frontend `recognizedWordIds`
- [ ] Remove frontend `readArticleIds`
- [ ] Remove or backend-drive fake `recently_covered_count`
- [ ] Remove outdated “frontend prototype” delete copy

## Validation Notes

Latest diagnostic run:

```text
backend: go test ./... passed
frontend: pnpm typecheck did not reach TypeScript because pnpm install was blocked by ignored build scripts
```

Before implementation is considered stable:

```bash
go test ./...
pnpm typecheck
pnpm test
pnpm build
```
