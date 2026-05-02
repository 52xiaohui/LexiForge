# AI Vocabulary Reading Platform 设计文档

> 版本：v0.1 · 日期：2026-04-25
>
> 第三方 AI 英语阅读与复习工具，可接入用户授权的词汇学习数据，生成个性化阅读材料和练习。

## 文档导航

| # | 文件 | 主要内容 |
|---|---|---|
| 01 | [产品定位与范围](01-product.md) | 项目概述 · 命名与品牌 · 目标用户 · MVP/v0.5/v1 范围 · 合规与数据边界 |
| 02 | [技术栈与架构](02-architecture.md) | 技术选型 · 系统架构图 · 后端分层 · 项目目录结构 |
| 03 | [数据库与评分模型](03-database.md) | 阶段化建表 · ER 图 · mastery_score / weak_score 算法 · 选词策略 |
| 04 | [REST API 与 MaiMemo Client](04-api.md) | REST API · MaiMemo Client · 同步/导入任务 · 错误响应 |
| 05 | [AI 生成工作流](05-ai-workflow.md) | 流程图 · Prompt 原则 · 结构化覆盖率检测 · 二次修正 |
| 06 | [前端设计](06-frontend.md) | 页面结构 · 控件设计 · 文章生成端到端时序图 |
| 07 | [安全与错误处理](07-security.md) | Token 加密 · 认证 · 限流 · 日志脱敏 · Token 生命周期时序图 · 错误码 |
| 08 | [部署与测试](08-deployment.md) | Docker Compose · 环境变量速查 · 生产部署 · 测试策略 |
| 09 | [里程碑与商业化](09-roadmap.md) | 4 周 Gantt · 风险与应对 · 商业化设计 · 开源策略 · 简历描述 · MVP 验收 |

## 阅读建议

- 第一次浏览：按 01 → 02 → 03 → 04 → 05 顺序看，建立完整心智模型
- 准备简历/答辩：直接看 02 架构图、03 ER 图、05 工作流图、09 简历模板
- 实施开发：按 09 里程碑 → 03 schema → 04 API → 05 AI workflow 推进
- 安全 review：07 + 08 环境变量 + 09 风险应对

## 阶段速览

```text
MVP    (4 周)         单用户 / env Token / users seed local-user / 同步 / 评分 / AI 生成 /
                       article_words 高亮 / 文章历史 / Docker / Demo
v0.5   (Demo 稳定后)   注册登录 / AES-GCM / sync_jobs 异步 / 限流 / CSRF / CORS / 数据披露 /
                       CSV / Anki 导入（去除墨墨 API 单点依赖）
v1                    阅读理解题 / 填空题 / 错题 / 学习报告 / 每日推荐 / 成本控制
v2 (草图)              考试专项模式（CET4/6, 雅思, 托福, GRE）— 变现切入
v3 (草图)              AI 背词模式（用户输入解释 + AI 判断）— 差异化护城河
```

各文件中带 `MVP` / `v0.5` / `v1` 标注的内容遵循同一时间轴；v2 / v3 仅作远期方向记录，详见 [09-roadmap.md](09-roadmap.md) 末尾"演进方向"。
