# Directory Structure

> How frontend code is organized in this project.

---

## Overview

`frontend/` is a Vite + React + TypeScript SPA. The repo is **not** a monorepo —
`frontend/` lives alongside `backend/` (Go), each with its own dependency tree.

Inside `frontend/src/`, code is organized by **role**, not by feature:

- **`app/`** wires up providers and routing
- **`pages/`** is one folder per route; each page may have local `components/`
- **`components/`** holds reusable pieces, split into `layout/`, `common/`, `ui/`
- **`lib/`** holds framework-free helpers (formatters, mock data, utils)
- **`types/`** holds shared TypeScript types — domain shapes mirroring the backend API
- **`hooks/`** (reserved for future shared hooks; empty in the MVP-style task)

---

## Directory Layout

```
frontend/
├── components.json              # shadcn config (preset: radix-maia, baseColor zinc, hugeicons)
├── package.json                 # pnpm scripts: dev / build / lint / format / typecheck / preview
├── tsconfig*.json               # baseUrl=. with paths: "@/*" -> "./src/*"
├── vite.config.ts               # @ alias + tailwindcss v4 plugin
└── src/
    ├── App.tsx                  # root: <Providers><RouterProvider/></Providers>
    ├── main.tsx                 # createRoot(<StrictMode><App/></StrictMode>)
    ├── index.css                # Tailwind v4 import + @theme inline tokens (zinc/OKLCH, dark CSS vars, pointer rule)
    ├── app/
    │   ├── providers.tsx        # QueryClientProvider + ThemeProvider + TooltipProvider
    │   └── router.tsx           # createBrowserRouter config with route handles
    ├── pages/
    │   ├── Dashboard/
    │   │   ├── index.tsx        # main dashboard composition
    │   │   └── components/      # page-local sub-components (RecentArticles, NextReview, …)
    │   ├── Vocab/index.tsx
    │   ├── VocabWeak/index.tsx
    │   ├── Articles/index.tsx
    │   ├── ArticleNew/index.tsx
    │   ├── ArticleDetail/index.tsx
    │   └── NotFound/index.tsx
    ├── components/
    │   ├── layout/              # cross-page chrome
    │   │   ├── AppShell.tsx
    │   │   ├── Sidebar.tsx
    │   │   ├── TopBar.tsx
    │   │   └── MobileNav.tsx
    │   ├── common/              # cross-page reusable pieces (StatCard, ComingSoon, …)
    │   ├── ui/                  # shadcn-generated primitives — DO NOT hand-edit unless adjusting a variant
    │   └── theme-provider.tsx   # light/dark + `d` shortcut, shipped by the preset
    ├── lib/
    │   ├── utils.ts             # cn() helper from shadcn
    │   ├── formatters.ts        # number/date/i18n string helpers
    │   └── mock-data.ts         # typed mock data for the prototype (drop-in replaceable)
    ├── types/
    │   └── api.ts               # domain types mirroring docs/04-api.md responses
    └── hooks/                   # reserved for shared hooks
```

---

## Module Organization

### Where new code goes

| What you're adding | Where it goes |
|---|---|
| A new route | `pages/<RouteName>/index.tsx`; declare in `app/router.tsx` with a `handle` |
| A sub-component used by exactly one page | `pages/<RouteName>/components/<Name>.tsx` |
| A component used by 2+ pages | `components/common/<Name>.tsx` |
| Cross-page chrome (nav, header, layout) | `components/layout/<Name>.tsx` |
| A new shadcn primitive | `pnpm dlx shadcn@latest add <name>` (lands in `components/ui/`) |
| A pure helper (no React) | `lib/<topic>.ts` |
| A shared domain type | `types/api.ts` (or split into `types/<topic>.ts` when it grows) |
| A custom hook used by 2+ components | `hooks/use<Name>.ts` |

### Promotion rule

A piece of code earns its way into `components/common/` only after it's needed in
**3+ places**. Until then, keep it page-local under `pages/<RouteName>/components/`.
Premature shared components ossify the wrong abstraction.

---

## Naming Conventions

- **Files**: hand-written components and pages use `PascalCase.tsx`
  (`Dashboard.tsx`, `StatCard.tsx`). Helpers use `kebab-case.ts` or
  `camelCase.ts` (`mock-data.ts`, `formatters.ts`).
- **shadcn-generated**: `kebab-case.tsx` (`button.tsx`, `card.tsx`) — preserved
  as the CLI writes them.
- **Components**: `PascalCase` exported names (`StatCard`, `AppShell`).
- **Hooks**: `useX` lowercase prefix (`useVocabSummary`).
- **Types**: `PascalCase` interfaces/types (`WeakWord`, `VocabSummary`).
- **Tailwind class order**: let `prettier-plugin-tailwindcss` sort — don't fight it.

---

## Path Alias

`@/` always resolves to `frontend/src/`. Use it for every import that crosses a
directory boundary; relative `./` paths are only used inside the **same** folder.

```ts
// good — crosses boundary
import { StatCard } from "@/components/common/StatCard"

// good — same folder
import { RecentArticles } from "./components/RecentArticles"
```

---

## Examples

- `src/pages/Dashboard/index.tsx` — page composes `StatCard` (common) with
  `RecentArticles` + `NextReview` (page-local).
- `src/components/common/StatCard.tsx` — reusable stat block, used in 4 places
  on Dashboard. Could move to a shared component once Vocab/Articles pages also
  need it.
- `src/app/router.tsx` — single source of truth for routes; each entry carries
  a `handle: { title, subtitle? }` that `TopBar` reads via `useMatches()`.
