# Implement Backend MVP

## Goal

Turn the vocabulary side of the current backend skeleton into a usable MVP core. This task should implement the data ingestion and query foundation that article generation will depend on: sync vocabulary from MaiMemo using the env token, persist scored records, and expose vocabulary/weak-word query endpoints.

## What I Already Know

- The current backend compiles and passes `go test ./...` / `go vet ./...`, but has no test files.
- MVP API routes are registered under `/api/v1`, but core endpoints currently return `501 NOT_IMPLEMENTED`.
- The project docs define MVP as single-user with a fixed `local-user` row and env-based `MAIMEMO_TOKEN` / `OPENAI_API_KEY`.
- Database schema docs require `users`, `vocab_words`, `study_records`, `articles`, and `article_words` in MVP.
- Article generation will be handled in a follow-up task after sync/vocab is reliable.
- `go.mod` currently targets Go `1.26.2`, while the Dockerfile builder uses `golang:1.22-alpine`.

## Requirements

- Implement `POST /api/v1/sync/maimemo` as synchronous MVP full-pull:
  - Read `MAIMEMO_TOKEN` from runtime config.
  - Call MaiMemo `query_study_records` with limit 1000.
  - Upsert `vocab_words` and `study_records` by documented provider keys.
  - Calculate `mastery_score`, `weak_score`, `score_reasons`, `score_version`, and `last_scored_at`.
  - Return sync counts and duration.
- Implement `GET /api/v1/sync/latest` using persisted record metadata derivable from `study_records`.
- Implement vocabulary endpoints:
  - `GET /api/v1/vocab/records`
  - `GET /api/v1/vocab/weak`
  - `GET /api/v1/vocab/summary`
  - `GET /api/v1/vocab/:id`
  - Support documented filters where feasible for MVP: pagination, `last_response`, `tag`, `min_weak_score`, `sort`.
- Align vocabulary persistence models with documented database constraints, including foreign keys where GORM can safely express them.
- Leave article endpoints as explicit 501 stubs in this task.
- Leave AI client DTO alignment to the follow-up article generation task.
- Align Docker build Go version with the module version or adjust the module version to a supported builder.
- Add focused tests for scoring, sync validation, repository upsert behavior, vocabulary queries, and handler-level error responses.

## Acceptance Criteria

- [ ] Sync and vocabulary endpoints no longer return 501.
- [ ] Article endpoints remain unchanged 501 stubs and are documented as follow-up scope.
- [ ] A local user can sync MaiMemo records using `MAIMEMO_TOKEN`.
- [ ] Re-running sync updates existing records instead of duplicating them.
- [ ] Vocabulary endpoints return paginated JSON shaped for frontend use.
- [ ] Weak words are ordered by `weak_score` by default.
- [ ] `go test ./...` passes with meaningful test files.
- [ ] `go vet ./...` passes.
- [ ] Docker build uses a Go version compatible with `go.mod`.

## Definition of Done

- Tests added or updated for new service/repository/handler behavior.
- `go test ./...` passes.
- `go vet ./...` passes.
- API errors use the shared `{code, message, details?}` envelope.
- Secrets are not logged.
- Any non-obvious implementation convention is captured in `.trellis/spec/` or task notes.

## Technical Approach

Use the existing three-layer structure: handler parses/serializes, service owns business rules, repository owns GORM. Keep the MVP single-user by consistently using `user.LocalUserID`. Implement the MaiMemo HTTP client behind the existing interface and test sync services with fakes where external API behavior is not the subject under test. Keep v0.5 features out of this task unless they are necessary to make MVP vocabulary behavior reliable.

## Decision (ADR-lite)

**Context**: The full backend MVP includes both vocabulary ingestion and article generation, but article generation depends on a reliable scored vocabulary dataset.

**Decision**: Implement the verifiable core chain first: MaiMemo sync, scoring, vocabulary queries, database/version alignment, and tests.

**Consequences**: The backend will still have 501 article endpoints after this task. That is intentional and keeps this change reviewable. A follow-up task should implement article generation and export using the now-available vocabulary data.

## Out of Scope

- Authentication, registration, sessions, or multi-user token storage.
- Redis-backed rate limiting.
- Async sync jobs and `sync_jobs`.
- CSV/Anki import.
- Article generation, article CRUD, and Markdown export.
- Exercise generation.
- AI usage accounting.
- Frontend changes.

## Open Questions

- None. User chose option 2: implement sync + vocabulary core first.

## Technical Notes

- Relevant docs:
  - `docs/02-architecture.md`
  - `docs/03-database.md`
  - `docs/04-api.md`
  - `docs/05-ai-workflow.md`
  - `docs/07-security.md`
- Relevant spec index:
  - `.trellis/spec/backend/index.md`
- Current high-risk files from review:
  - `backend/internal/article/handler.go`
  - `backend/internal/vocabulary/handler.go`
  - `backend/internal/maimemo/handler.go`
  - `backend/internal/ai/client.go`
  - `backend/internal/article/model.go`
  - `backend/internal/vocabulary/model.go`
  - `backend/go.mod`
  - `backend/Dockerfile`
