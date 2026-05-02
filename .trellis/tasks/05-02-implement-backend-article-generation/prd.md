# Implement Backend Article Generation MVP

## Goal

Complete the backend MVP value loop after vocabulary sync: use scored vocabulary records to generate AI articles, persist coverage metadata, expose article read/manage endpoints, and export Markdown.

## What I Already Know

- The previous task implemented MaiMemo sync and vocabulary query endpoints.
- Article routes are already registered but still return `501 NOT_IMPLEMENTED`.
- MVP article generation must create a new `articles` row and new `article_words` rows on every `POST /articles/generate`.
- There is no update/regenerate endpoint in MVP; regeneration means creating a new article with the same request parameters.
- `article_words` must contain one row for every target word, covered or not.
- Coverage offsets must be Unicode code point units.
- AI output must include verbatim context around each covered form so the backend can locate occurrences by string search.

## Requirements

- Implement `POST /api/v1/articles/generate`:
  - Parse JSON body with `topic`, `difficulty`, `target_word_count`, `article_length`, and optional `target_word_ids`.
  - Validate `15 <= target_word_count <= 80`.
  - Validate `len(target_word_ids) <= target_word_count`.
  - Validate selected `target_word_ids` belong to the local user.
  - Prefer selected words and fill remaining target slots from local vocabulary using the documented 70/20/10 strategy.
  - Call the OpenAI-compatible client behind the existing `ai.Client` interface.
  - Request structured JSON only; do not include exercises.
  - Locate covered word forms using `context_before + form + context_after`.
  - Store `char_offset` and `char_length` as Unicode code point counts.
  - Retry generation at most 2 times when coverage is below 90%.
  - Persist `articles` and all `article_words` atomically.
  - Return `article_id`, `status`, `covered_word_count`, `target_word_count`, and `coverage_rate`.
- Implement article read/manage endpoints:
  - `GET /api/v1/articles`
  - `GET /api/v1/articles/:id`
  - `DELETE /api/v1/articles/:id`
  - `GET /api/v1/articles/:id/export.md`
- Align `ai.GenerateArticleResponse` / `ai.CoveredWord` with the docs/05 contract, including `occurrence` and `missing_words`.
- Implement the OpenAI-compatible HTTP client enough for MVP article generation.
- Keep auth/multi-user/token storage out of scope; use `user.LocalUserID`.
- Add focused tests for request validation, target word selection, coverage location, repository transaction behavior, Markdown export, and AI client parsing/error behavior.

## Acceptance Criteria

- [ ] Article MVP endpoints no longer return 501.
- [ ] Invalid generation requests return documented 422-style error codes.
- [ ] Selected target words are ownership-checked against local-user records.
- [ ] Generation creates one new article each time and never mutates a prior article.
- [ ] Every target word gets exactly one `article_words` row.
- [ ] Covered words have `is_covered=true`, form/context/offset/length populated.
- [ ] Missing words have `is_covered=false` and null offset/length fields.
- [ ] Coverage rate equals covered target rows divided by target word count.
- [ ] Article detail returns article plus target word coverage rows.
- [ ] Markdown export returns article content and target word coverage summary.
- [ ] `go test ./...` passes.
- [ ] `go vet ./...` passes.

## Definition of Done

- Tests added or updated for service, coverage, handler, and AI client behavior.
- API errors use the shared `{code, message, details?}` envelope.
- OpenAI API key is not logged or returned.
- README or specs updated if implementation establishes a reusable contract.
- Article generation remains independent from v1 exercise generation.

## Technical Approach

Use existing backend layering: handler parses/serializes, service owns validation/selection/generation/coverage orchestration, repository owns GORM transactions. Inject an `ai.Client` into `article.Service`. Keep article generation synchronous for MVP.

## Decision (ADR-lite)

**Context**: Article generation is the second half of the MVP and depends on scored vocab records.

**Decision**: Implement article generation synchronously and persist a complete article + target-word coverage snapshot per request.

**Consequences**: The flow is simple and demo-friendly. It may be slow for long articles, but async jobs and usage accounting remain v1/v0.5+ work.

## Out of Scope

- Frontend pages.
- Exercise generation.
- AI usage logs and quotas.
- Auth/multi-user support.
- Async generation jobs.
- CSV/Anki imports.

## Open Questions

- None for MVP; use the documented synchronous article generation behavior.

## Technical Notes

- Relevant docs:
  - `docs/03-database.md`
  - `docs/04-api.md`
  - `docs/05-ai-workflow.md`
  - `docs/07-security.md`
- Relevant backend files:
  - `backend/internal/article/*`
  - `backend/internal/ai/client.go`
  - `backend/internal/vocabulary/*`
  - `backend/internal/httpx/error.go`
