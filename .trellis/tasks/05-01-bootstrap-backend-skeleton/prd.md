# Bootstrap Backend Skeleton

## 目标

按 `docs/` 目录下的设计文档,搭建 LexiForge / Memo-Skills 项目的 Go 后端骨架,使开发可以基于该骨架直接进入 MVP 业务实现阶段。

骨架范围对齐文档:
- `docs/02-architecture.md` — 技术栈、目录结构、分层
- `docs/03-database.md` — MVP schema (users / vocab_words / study_records / articles / article_words)
- `docs/04-api.md` — REST 端点列表、`/api/v1` 前缀
- `docs/07-security.md` — Token 来自环境变量、日志脱敏占位

## 范围 (Scope)

### In-scope (本次必做)

1. **Go 模块 & 项目布局**
   - `backend/go.mod`,module path = `lexiforge/backend`,Go 1.22+
   - 按 `docs/02-architecture.md` 的 `backend/` 目录结构创建目录与占位文件
   - `cmd/server/main.go` 启动 Gin,加载 config,连接 DB,执行 AutoMigrate,seed local-user,注册路由,起 HTTP server

2. **配置加载**
   - `internal/config/config.go` 用环境变量加载:
     - `APP_PORT` (default `8080`)
     - `APP_ENV` (`development` / `production`)
     - `DATABASE_URL`
     - `MAIMEMO_TOKEN`
     - `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`
     - `LOG_LEVEL`
   - 提供 `.env.example`(repo 根)

3. **数据库层**
   - `internal/database/db.go`:用 GORM 打开 Postgres,返回 `*gorm.DB`
   - `internal/database/migrations.go`:`RunMigrations()` 用 GORM AutoMigrate 创建 MVP 5 张表 + seed local-user (固定 UUID `00000000-0000-0000-0000-000000000001`)
   - GORM model 文件分布在各 domain 包:
     - `internal/user/model.go` — `User`
     - `internal/vocabulary/model.go` — `VocabWord`,`StudyRecord`
     - `internal/article/model.go` — `Article`,`ArticleWord`
   - 字段、索引、唯一键严格遵循 `docs/03-database.md`(`unique(provider, provider_voc_id)`、`unique(user_id, provider, provider_voc_id)`、`unique(article_id, word_id)` 等)

4. **HTTP 中间件**
   - `internal/middleware/cors.go` — 默认开发期允许 localhost
   - `internal/middleware/logger.go` — 请求日志,Authorization / token 字段脱敏
   - `internal/middleware/recover.go` — panic 兜底,统一 500 JSON

5. **路由 & 占位 handler**
   - 全部 MVP 端点 (`docs/04-api.md` 端点速查表里 阶段=MVP 的) 注册到 `/api/v1`,返回 `501 Not Implemented` JSON `{"code":"NOT_IMPLEMENTED","message":"<endpoint> pending"}`
   - `GET /healthz` 返回 200 `{"status":"ok"}`
   - 各 domain 提供 `handler.go` / `service.go` / `repository.go` 占位文件 + 接口签名,内部 stub 即可
   - 涉及 domain:`maimemo` (sync)、`vocabulary`、`article`、`export`

6. **External Client 占位**
   - `internal/maimemo/client.go` — 接口和构造函数定义,方法体 `return nil, errors.New("not implemented")`
   - `internal/ai/client.go` — 同上
   - 接口签名见 `docs/04-api.md` "MaiMemo API Client Interface" 节

7. **错误响应类型**
   - `internal/httpx/error.go`(或类似位置)定义统一 JSON 错误响应结构 `{code, message, details}`,handler 复用

8. **Docker / Compose**
   - `backend/Dockerfile` — 多阶段构建,生成静态二进制
   - 仓库根 `docker-compose.yml`:
     - `postgres:16-alpine` 服务,持久卷,健康检查
     - `backend` 服务,depends_on postgres healthy,环境变量从 `.env` 读取
     - 启动后 backend 应自动 migrate 并 seed
   - 仓库根 `.env.example`(简明)

9. **README / 启动说明**
   - `backend/README.md`:本地启动步骤、`docker compose up` 步骤、环境变量说明、目录树概览

10. **Git 跟踪**
    - 在仓库根更新或新增 `.gitignore`(忽略 `backend/tmp/`、`*.env`、`backend/bin/`、`__pycache__` 等)
    - 完成后由 main agent 在 Phase 3.4 主导 commit

### Out-of-scope (本次不做)

- 任何业务逻辑实现(同步、评分、AI 文章生成、覆盖率) — 全部 501
- 用户注册登录(v0.5 才做)
- AES-GCM 加密 / `user_tokens` 表(v0.5 才做)
- Redis、限流、异步 job(v0.5)
- 单元测试(后续单独任务)
- 前端、CI

## 关键设计决策

1. **module path = `lexiforge/backend`**(用户选定)
2. **MVP 单用户**:Token 走 `MAIMEMO_TOKEN` 环境变量,DB 只 seed 一行 local-user(UUID `00000000-0000-0000-0000-000000000001`),所有外键指向它
3. **AutoMigrate**:启动时调用 `db.AutoMigrate(...)`,免去手写 SQL migration 文件;v0.5 再切到正式 migration 工具(goose / golang-migrate)
4. **501 stubs**:所有 MVP endpoint 注册到路由,但返回 501,这样接口契约可见、前端可对接 mock,但本任务不写业务
5. **三段分层**:每个 domain 包都有 `handler.go` (Gin handler) → `service.go` (业务编排) → `repository.go` (GORM CRUD),即便此次 service/repository 体内为空,也建立分层骨架
6. **错误响应结构统一**:`{code, message, details?}`,与 `docs/04-api.md` 错误示例一致

## 验收标准 (Acceptance Criteria)

- [ ] `cd backend && go build ./...` 成功
- [ ] `cd backend && go vet ./...` 无错误
- [ ] `docker compose up -d` 后:
  - postgres 健康
  - backend 启动日志显示 migration 完成 + seed local-user
  - `curl localhost:8080/healthz` 返回 `{"status":"ok"}`
  - `curl -X POST localhost:8080/api/v1/sync/maimemo` 返回 501 JSON(且包含 code/message)
- [ ] `docs/03-database.md` MVP 5 张表全部存在,字段名、唯一约束与文档一致
- [ ] `users` 表存在 1 行 `id = 00000000-0000-0000-0000-000000000001`
- [ ] 目录树和 `docs/02-architecture.md` "后端目录结构" 节一致(允许根据本次范围裁剪未涉及的子目录)
- [ ] `git status` 干净后,工作区能反映完整骨架

## 风险与备注

- Windows 开发环境,`docker compose` 命令应能跑通;如本机未启 Docker,只验证 `go build` 与 `go vet`
- GORM v2 用法注意:UUID 字段使用 `github.com/google/uuid`,主键标签用 `gorm:"type:uuid;primaryKey"`,Postgres 端用 `pgcrypto` 或 GORM hook 生成 UUID
- 文档中的 v0.5/v1 表(user_tokens / sync_jobs / import_jobs / exercises / ai_usage_logs)**不在本次创建** — 只建 MVP 5 张
