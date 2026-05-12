# Remove frontend nested git

## Goal

Remove the nested Git repository metadata under `frontend/` so the whole project is managed by the root Git repository.

## Requirements

* Delete only `frontend/.git`.
* Preserve all frontend source files and configuration files.
* Verify the root repository sees `frontend/` files as regular worktree files after removal.

## Acceptance Criteria

* [x] `frontend/.git` no longer exists.
* [x] Root `git status` shows frontend files directly, not as a nested repository boundary.
* [x] No unrelated files are reverted or modified.

## Definition of Done

* Required filesystem change is complete.
* Verification commands are run and summarized.
* Existing unrelated dirty files remain untouched.

## Technical Approach

Resolve and verify the nested Git directory path, remove it recursively, then inspect root Git status.

## Out of Scope

* Rewriting frontend source code.
* Creating commits.
* Changing `.gitignore` rules unless separately requested.

## Technical Notes

* User requested: "移除frontend目录下的git,整个项目统一使用一个git管理."
* Current root `git status` already sees individual `frontend/` files as untracked.
* `frontend/.git` was not present when checked.
* `git -C frontend rev-parse --show-toplevel` resolves to the root repository: `C:/Users/kinghui/Desktop/temp/LexiForge`.
