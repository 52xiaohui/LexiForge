# 整理 git 提交与忽略规则

## Goal

梳理当前首次初始化仓库的未跟踪文件，补齐合理的 `.gitignore` 规则，并给出可执行的本地提交方案，避免把本地运行态、密钥、缓存或外部参考目录误提交。

## What I Already Know

- 仓库目前没有历史提交，`git ls-files` 为空。
- 当前未跟踪内容主要分为：项目文档、Go backend skeleton、Trellis/Codex/Claude 项目工作流配置、根级配置文件。
- 已被忽略的本地内容包括 `.claude/settings.local.json`、`.trellis/.runtime/`、`.trellis/workspace/`、`.trellis/.developer`、Python `__pycache__/` 和 `memo-api/`。
- `memo-api/` 是本地 MaiMemo API skill/reference 目录，当前 `.gitignore` 已忽略。

## Requirements

- 检查当前 dirty/ignored 状态，区分建议提交与建议忽略的文件。
- 补齐 `.gitignore` 中缺失的通用本地、密钥、缓存和构建产物规则。
- 保留可提交的项目源码、文档、Trellis 项目规范、平台代理/技能配置。
- 给出分批提交或一次性提交的建议计划；执行提交前需要用户确认。

## Acceptance Criteria

- [ ] `.gitignore` 覆盖本地 env 变体、OS/editor 垃圾文件、日志、缓存、常见前端依赖和构建产物。
- [ ] `git status --ignored` 中不会暴露应忽略的本地运行态。
- [ ] 提交计划明确列出将提交的文件组和不会提交的忽略/本地内容。
- [ ] 未经用户确认，不执行 `git commit`。

## Out of Scope

- 不删除 `memo-api/` 或其他本地参考目录。
- 不推送远程仓库。
- 不审查 backend 业务实现质量，除非提交前基础检查暴露阻塞问题。

## Technical Notes

- 根 `.gitignore` 负责跨工具和跨语言的通用忽略规则。
- `.trellis/.gitignore` 已负责 Trellis 内部 runtime、workspace、developer identity 和 Python 缓存。
