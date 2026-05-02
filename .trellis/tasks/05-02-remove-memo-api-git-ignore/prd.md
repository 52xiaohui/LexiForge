# Remove memo-api from Git History and Ignore Folder

## Goal

Remove the `memo-api` folder from the root repository's Git history and ensure future local changes under that folder are ignored.

## Requirements

* If `memo-api/.git` exists, remove that nested Git metadata only.
* Keep the local `memo-api` folder and its contents on disk.
* Rewrite local Git history so `memo-api/**` is removed from historical commits.
* Remove already tracked `memo-api/**` files from the current root Git index.
* Add `memo-api/` to the root `.gitignore`.
* Preserve unrelated local work.

## Acceptance Criteria

* [ ] `memo-api/.git` does not exist.
* [ ] `memo-api/` appears in `.gitignore`.
* [ ] `git ls-files memo-api` returns no tracked files after the index update.
* [ ] `git log --oneline -- memo-api` returns no commits after history rewrite.
* [ ] Local files under `memo-api/` still exist.

## Definition of Done

* The change is limited to Git history/index state and `.gitignore`.
* `git status --short --ignored -- memo-api` shows `memo-api/` as ignored after removal from the index.
* The user is informed that rewriting history changes commit hashes and requires coordination before pushing.

## Technical Approach

Prefer `git-filter-repo` with `--path memo-api/ --invert-paths` for history rewriting. Use PowerShell-native file operations for any `.git` metadata removal. Use `git rm --cached -r memo-api` only for ordinary index cleanup if history rewrite is not being performed.

## Out of Scope

* Deleting the `memo-api` folder itself.
* Modifying files inside `memo-api`.
* Pushing to remote.

## Technical Notes

* `memo-api/.git` was not present during initial inspection.
* `git ls-files memo-api` showed tracked files, so root index cleanup is required.
* `git log --oneline -- memo-api` showed historical commits, so full history cleanup requires a history rewrite.
* Current Codex process cannot create `.git/index.lock` in this workspace due `.git` ACL restrictions, so commands that rewrite history or update the index must be run from a shell with working `.git` write permissions.
