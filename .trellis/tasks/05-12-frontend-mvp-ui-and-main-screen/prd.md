# frontend MVP prototype: UI style + main interface

## Goal

为 LexiForge 前端 MVP 建立**视觉风格基线（设计系统）**并实现**主界面**，作为后续 6 个 MVP 页面共同的样板。本任务只产出原型形态，重点是把视觉风格 + 关键页面定调，其他页面以独立任务推进。

## What I already know (from docs/)

- **产品**：LexiForge — AI 个性化英语阅读平台，把墨墨学习数据 → 评分 → AI 文章 → 高亮 + 导出
- **推荐技术栈**（`docs/02-architecture.md` 已定）：
  - Vite + React + TypeScript
  - Tailwind CSS + shadcn/ui
  - React Router + TanStack Query
- **MVP 不开放登录注册**：单用户、env Token、`local-user` seed，前端不需要鉴权/Token 配置 UI
- **前端目录尚未创建**；后端 `backend/` 已基本成形
- **MVP 共 6 个页面**（`docs/06-frontend.md`）：

  | 路由 | 内容 |
  |---|---|
  | `/dashboard` | 总单词数 / 薄弱词数量 / 今日进度 / 最近同步时间 / 最近生成文章 / 下次建议复习 |
  | `/vocab` | 全部单词 |
  | `/vocab/weak` | 薄弱词表格：`last_response` / `STICKING` 筛选 / `weak_score` 排序 / 勾选目标词 |
  | `/articles` | 文章历史 + 删除 |
  | `/articles/new` | 主题 / 难度 A2–C1 / 目标词数（15–80） / 文章长度（短/中/长）。支持 `?target_word_ids=...` 联动默认值 |
  | `/articles/:id` | 正文 + 目标词高亮（`char_offset`） + 覆盖率徽章 + 未覆盖词列表 + Markdown 导出 + 重新生成 |

- **前端 spec 模板**（`.trellis/spec/frontend/`）全部是空模板，需要在本任务中沉淀基本约定（目录结构、组件、状态管理）
- **多设备使用**：docs/01 强调"通勤路上手机/平板/PC 都能用" → 响应式必须做
- **第三方数据流**：所有外部 API（墨墨、AI）经 Go 后端代理，前端不持有 Token

## Assumptions (await confirmation)

- "**主界面**" = `/dashboard`（首页 + 应用入口）
- 本任务范围 = **设计系统 + Dashboard + 应用 shell（顶部 / 侧边导航 + 路由占位）**
- **mock 数据先行**：原型阶段不连真实后端，便于纯前端快速迭代；接入后端做后续任务
- 中文 UI（产品面向中国英语学习者）；技术文档保持英文
- 暗色模式：本期只在 design token 层预留 CSS 变量，不实装切换
- 后续 5 个页面在本任务**只做空路由占位**（点导航能跳，内容是 placeholder）

## Open Questions

1. **scope 确认**：主界面是否指 Dashboard？范围是 shell + Dashboard + 其他 5 个路由占位？
2. **UI 风格方向**：用户是否已有视觉参考（图、应用名、Dribbble/Behance 链接），还是希望我先调研同类产品（Anki / Duolingo / Lingvist / Readwise / Linear / Notion 等）再给出 2–3 个具体方向？

## Requirements (evolving)

- 初始化 `frontend/`：Vite + React + TS + Tailwind + shadcn/ui + React Router + TanStack Query
- 建立 design tokens（颜色 / 字号 / 间距 / 阴影 / 圆角 / 暗色 CSS 变量）
- App shell：logo + 主导航 + 移动端折叠
- Dashboard：6 个信息块 + 真实视觉风格
- 其他 5 个 MVP 路由占位
- mock data 模块（便于后续替换为 TanStack Query）

## Acceptance Criteria (evolving)

- [ ] `cd frontend && npm run dev` 可在浏览器打开
- [ ] 访问 `/dashboard` 看到完整视觉样式（mock 数据）
- [ ] 顶/侧导航可跳到 `/vocab`、`/vocab/weak`、`/articles`、`/articles/new`、`/articles/:id` 占位页
- [ ] design tokens 集中定义（不散落在 className 里）
- [ ] 移动端断点（375 / 768 / 1280）布局不溢出
- [ ] `npm run build` + `npm run typecheck` 通过

## Definition of Done

- 视觉风格在 README 或 storybook-like 页面（如 `/design`）展示
- `.trellis/spec/frontend/` 的 directory-structure / component-guidelines / state-management 至少填充骨架
- 构建 + lint + typecheck 全部通过
- prd.md / 实施记录沉淀，便于后续 5 个页面任务复用

## Out of Scope (explicit)

- 真实后端 API 接入（用 mock 数据）
- 5 个非主界面页面的真实内容（仅占位）
- 鉴权 / 登录 / 多用户 UI
- i18n（中文 UI 即可）
- 暗色模式切换实装（token 层预留即可）
- 单元/组件测试（原型阶段优先视觉迭代）

## Technical Notes

- 后端 API 路径见 `docs/04-api.md`，类型可后续基于响应手写或 OpenAPI 生成
- 文章高亮基于 `article_words.char_offset` + `char_length`（Unicode code point）
- 文章生成校验约束（`docs/06-frontend.md`）：15 ≤ `target_word_count` ≤ 80，`len(target_word_ids) ≤ target_word_count`

## shadcn CLI 初始化决策

| 选项 | 值 | 理由 |
|---|---|---|
| `--template` | `vite` | 已由 `docs/02-architecture.md` 锁定 |
| `--base` | `radix` | 主流 primitive，生态最成熟（`base` 是 2026/03 才加的新选项） |
| `--pointer` | on | Tailwind v4 按钮默认 `cursor: default`，开了恢复 `cursor: pointer` |
| `--monorepo` | off | 只有 1 个 React 前端 + Go 后端，不是 monorepo 场景 |
| `--rtl` | off | 中文 UI + 英文内容，目标用户无 RTL 需求 |
| `baseColor` | 由 preset 决定 | 用户在 [ui.shadcn.com/create](https://ui.shadcn.com/create) 定制后用 `--preset b3YR1PbnXs` 一次性应用全套配色 / token / 组件默认量 |
| `--name` | `frontend` | scaffold 到 `frontend/` 子目录，与 `backend/` 平级 |
| 包管理器 | `pnpm` | 用户偏好，用 `pnpm dlx` 而非 `npx` |

最终 CLI（在 `LexiForge/` 根目录执行）：
```bash
pnpm dlx shadcn@latest init --preset b3YR1PbnXs --template vite --pointer --name frontend
```

注：用户原命令未带 `--no-monorepo` / `--no-rtl`，使用 preset 时这些开关由 preset 决定（preset 已经包含完整配置），不需要再显式指定。

## Research References

(待补充：UI 风格调研，根据用户问题 2 的答案决定是否调研)
