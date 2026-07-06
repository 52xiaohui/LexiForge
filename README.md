<div align="center">

# LexiForge

**把薄弱词锻造成读得进去的英文。**

LexiForge 是一个 AI 词汇阅读工具：它会把已有的词汇学习数据转化为
定制英文文章，让薄弱词出现在自然、连贯的上下文里，而不是继续停留在孤立的
单词卡片中。

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=flat-square&logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=0B1021)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-required-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-black?style=flat-square)

</div>

---

## 项目简介

LexiForge 会读取你已经积累的学习记录，找出需要放到语境里巩固的单词，再通过
OpenAI-compatible 模型生成带有目标词的英文阅读材料。

当前 MVP 范围比较克制，默认面向单用户、本地或演示环境：

| 模块 | MVP 行为 |
|---|---|
| 词汇来源 | 通过 `MAIMEMO_TOKEN` 同步墨墨学习记录 |
| 薄弱词计算 | 后端计算 `mastery_score` 和 `weak_score` |
| 文章生成 | 根据主题、CEFR 难度、文章长度和目标词生成文章 |
| 覆盖率追踪 | 每个目标词都会写入 `article_words`，包含未覆盖词 |
| 阅读流程 | 持久化阅读进度和本地词汇反馈事件 |
| 导出能力 | 由后端提供文章 Markdown 导出 |

MVP 模式是 `external_assist`：LexiForge 是墨墨或其他背词工具的语境阅读助手，
不会改动外部 App 的学习状态。

## 核心流程

```mermaid
flowchart LR
    A[同步词汇数据] --> B[计算掌握度和薄弱度]
    B --> C[选择薄弱目标词]
    C --> D[生成阅读文章]
    D --> E[高亮阅读]
    E --> F[记录本地反馈]
    F --> B
```

## 功能入口

| 路由 | 用途 |
|---|---|
| `/dashboard` | 学习总览、最近同步、下一步行动、最近文章 |
| `/vocab` | 浏览全部已同步词汇 |
| `/vocab/weak` | 筛选、选择、忽略或置顶薄弱词 |
| `/articles` | 查看已生成文章历史 |
| `/articles/new` | 根据主题、难度、长度和目标词生成文章 |
| `/articles/:id` | 阅读、高亮、导出、重新生成和记录反馈 |

## 系统架构

```mermaid
graph TB
    Browser[Browser]
    FE[Vite + React + TypeScript SPA]
    API[Go + Gin API]
    DB[(PostgreSQL)]
    Mai[MaiMemo Open API]
    AI[OpenAI-compatible provider]

    Browser --> FE
    FE -->|REST / JSON| API
    API --> DB
    API --> Mai
    API --> AI
```

前端是纯静态 SPA，只负责 UI 渲染、管理本地偏好，并通过
`VITE_API_BASE_URL` 调用后端 REST API。

后端承担业务核心：同步、评分、文章生成、覆盖率校验、阅读进度、本地学习事件、
Markdown 导出、CORS、日志和数据库持久化。

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | Vite, React, TypeScript, Tailwind CSS, shadcn/ui-style components, TanStack Query, React Router |
| 后端 | Go, Gin, GORM |
| 数据库 | PostgreSQL |
| AI | OpenAI API 或兼容 OpenAI 协议的大模型服务 |
| 部署方向 | 静态前端 + Go API + 托管 PostgreSQL |

Redis、登录注册、第三方 Token 加密存储、异步任务、额度系统和多用户边界都不在
当前 MVP 内。

## 快速启动

### 1. 准备环境变量

```bash
cp .env.example .env
```

按需编辑 `.env`：

```bash
DATABASE_URL=postgres://lexiforge:lexiforge@localhost:5432/lexiforge?sslmode=disable
MAIMEMO_TOKEN=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

首次本地运行时，创建 PostgreSQL 用户和数据库：

```bash
psql -U postgres -c "CREATE ROLE lexiforge LOGIN PASSWORD 'lexiforge';"
psql -U postgres -c "CREATE DATABASE lexiforge OWNER lexiforge;"
```

如果用户或数据库已经存在，保留现有配置继续即可。

### 2. 启动后端

```bash
cd backend
go run ./cmd/server
```

健康检查：

```bash
curl http://localhost:8080/healthz
```

预期响应：

```json
{"status":"ok"}
```

### 3. 启动前端

如果前端依赖已经安装：

```bash
cd frontend
./node_modules/.bin/vite --host 0.0.0.0
```

如果是全新 checkout，并且 `pnpm` 可用：

```bash
cd frontend
pnpm install
pnpm dev
```

前端默认 API 地址：

```bash
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

打开终端打印出的 Vite 地址即可，通常是 `http://localhost:5173`。

## 常用 API

```bash
# 同步墨墨记录
curl -X POST http://localhost:8080/api/v1/sync/maimemo

# 查看薄弱词
curl "http://localhost:8080/api/v1/vocab/weak?min_weak_score=80"

# 生成文章
curl -X POST http://localhost:8080/api/v1/articles/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "campus life",
    "difficulty": "B1",
    "article_length": "medium",
    "target_word_count": 30
  }'
```

所有业务接口都位于：

```text
/api/v1
```

## 校验命令

后端：

```bash
cd backend
go test ./...
```

前端，在本仓库里直接调用本地二进制更可靠：

```bash
cd frontend
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```

仓库格式检查：

```bash
git diff --check
```

## 项目结构

```text
.
├── backend/                 Go API、领域模块、数据库迁移
│   ├── cmd/server/          HTTP 入口
│   └── internal/            config、database、vocab、article、AI、sync、export
├── frontend/                Vite + React + TypeScript SPA
│   └── src/                 pages、components、hooks、API client、types
├── docs/
│   ├── core/                产品、架构、数据模型、API、AI 工作流
│   ├── decisions/           决策记录
│   ├── progress/            当前执行和状态记录
│   └── ideas/               尚未承诺的未来想法
├── .env.example             本地配置模板
└── LICENSE
```

## 文档地图

| 文档 | 适合什么时候读 |
|---|---|
| [`docs/core/product.md`](docs/core/product.md) | 产品定位、MVP 范围、数据边界 |
| [`docs/core/architecture.md`](docs/core/architecture.md) | 技术选型和系统结构 |
| [`docs/core/data-model.md`](docs/core/data-model.md) | 表结构、评分模型、本地学习信号 |
| [`docs/core/api.md`](docs/core/api.md) | REST 接口契约 |
| [`docs/core/ai-workflow.md`](docs/core/ai-workflow.md) | Prompt 流程和覆盖率校验 |
| [`docs/core/frontend.md`](docs/core/frontend.md) | 页面职责和 UX 边界 |
| [`docs/progress/current.md`](docs/progress/current.md) | 当前阶段和验证记录 |
| [`backend/README.md`](backend/README.md) | 后端启动、环境变量和编码约定 |
| [`frontend/README.md`](frontend/README.md) | 前端脚本和运行时说明 |

## 数据边界

MVP 可以发送给 AI provider 的字段：

```text
word
last_response
study_count
tags
topic
difficulty
article_length
```

不能发送密钥或原始身份数据：

```text
MAIMEMO_TOKEN
passwords
email/phone
raw logs
full third-party authorization headers
```

## 当前状态

仓库当前进度记录为：

```text
Stage: MVP data foundation stabilization
Status: Technical debt pass complete; data foundation stable
```

前后端已对单词偏好、词汇事件、文章进度、文章生成参数和带进度的文章列表实现了真正的持久化。

## 许可证

MIT. See [`LICENSE`](LICENSE).
