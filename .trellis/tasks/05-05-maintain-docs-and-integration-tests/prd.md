# Maintain Docs and Integration Tests

## Goal

Clean up repository documentation drift and raise backend confidence by aligning AI provider environment variable names, deleting the obsolete root README, and adding backend integration coverage for the implemented MVP data flows.

## What I Already Know

* The docs currently describe AI variables as `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`.
* The backend config and `.env.example` use `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`.
* The root `README.md` still describes the older memo-skills project and no longer matches LexiForge.
* The backend already has unit tests for article, vocabulary, AI, and MaiMemo packages.
* `docker-compose.yml` currently runs Postgres and the Go backend; there is no frontend service yet.

## Assumptions

* "处理相关的 git 记录" means remove the obsolete root README from version control and include it in the final commit plan. It does not mean rewriting Git history or amending old commits.
* The docs should standardize on the implementation's current `OPENAI_*` variable names instead of renaming code.
* Integration tests should be self-contained Go tests and skip gracefully when Postgres is not available.

## Requirements

* Replace docs references to `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` with the backend-supported `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`.
* Delete the obsolete root `README.md`.
* Add backend integration tests covering MVP database-backed flows.
* Keep test fixtures isolated and avoid real MaiMemo or real AI network calls.
* Do not introduce frontend work, auth, Redis, async jobs, or v0.5 features in this task.

## Acceptance Criteria

* [ ] `rg "AI_API_KEY|AI_BASE_URL|AI_MODEL"` only finds intentional legacy/explanatory references, or none.
* [ ] Root `README.md` is removed from the working tree and tracked deletion appears in `git status`.
* [ ] Backend integration tests exercise database migration/seed behavior and at least one full repository-backed article persistence/read/export flow.
* [ ] Integration tests do not require real external service credentials.
* [ ] `go test ./...` passes.

## Definition of Done

* Tests added or updated for the new integration coverage.
* Docs updated for environment variable naming consistency.
* Git status reviewed and a commit plan prepared for user confirmation.

## Technical Approach

Use the existing backend package boundaries and test patterns. Add integration tests under backend packages using real PostgreSQL when `LEXIFORGE_TEST_DATABASE_URL` or `DATABASE_URL` points to an available test database, and skip otherwise. Reuse `database.RunMigrations`, `article.NewRepository`, and existing service/client fakes instead of duplicating app wiring.

## Out of Scope

* Rewriting Git commit history.
* Creating a new root README replacement.
* Adding frontend MVP screens.
* Adding v0.5 auth, token encryption, Redis limits, async sync jobs, CSV/Anki import, or deployment changes beyond docs variable names.

## Technical Notes

* Relevant docs: `docs/08-deployment.md`, `docs/09-roadmap.md`.
* Relevant backend specs: `.trellis/spec/backend/index.md`, `.trellis/spec/backend/database-guidelines.md`.
* Relevant code patterns: `backend/internal/article/service.go`, `backend/internal/database/migrations.go`, package-local handler/service tests.
