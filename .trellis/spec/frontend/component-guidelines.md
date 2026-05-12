# Component Guidelines

> How components are built in this project.

---

## Overview

The component layer is built on **shadcn/ui** primitives (Radix UI under the
hood) styled with **Tailwind CSS v4** through CSS-only `@theme inline` tokens.
Components do not own state beyond what's strictly local to the UI; data state
flows through TanStack Query, URL state through React Router.

---

## Component Structure

A typical hand-written component:

```tsx
// src/components/common/StatCard.tsx
import type { ReactNode } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatCardTone = "default" | "accent" | "warning"

export interface StatCardProps {
  label: string
  value: ReactNode
  icon: IconSvgElement
  tone?: StatCardTone
  hint?: ReactNode
  footer?: ReactNode
}

export function StatCard({ label, value, icon, tone = "default", hint, footer }: StatCardProps) {
  // …
}
```

Rules:

1. **Named exports** for components — `export function Foo()`. Default exports
   are reserved for `App.tsx` so Vite's HMR + React Refresh work cleanly.
2. **One component per file** unless tightly coupled (e.g. `Card` + `CardHeader`
   + `CardContent` in the shadcn primitive — that pattern is OK).
3. **Props interface above the component**, named `<ComponentName>Props`.
4. **No prop spreading from `any`** — extend `React.ComponentProps<"tag">` when
   passing through native attributes (see shadcn primitives for examples).

---

## Props Conventions

- **Required props first**, optional props after, all camelCase.
- **`ReactNode` for slot-like props** (`value`, `hint`, `footer`) so callers can
  pass a string or JSX uniformly.
- **Discriminated unions** for variants — use shadcn's `cva` + `VariantProps`
  pattern (see `button.tsx`, `badge.tsx`).
- **No boolean blizzards** — if you have 3+ booleans like `isPrimary` /
  `isLarge` / `isOutlined`, collapse them to a `variant` / `size` enum.
- **Children over render props** unless you need typed slots.

---

## Composition Patterns

### shadcn `asChild` pattern

Most shadcn primitives expose `asChild` (powered by `radix-ui`'s `Slot.Root`)
so the rendered element can be swapped:

```tsx
<Button asChild variant="outline" size="sm">
  <Link to="/articles">查看全部</Link>
</Button>
```

This lets a `<Link>` inherit `Button` styling without nesting a `<button>`
inside an `<a>` (which is invalid HTML).

### `data-slot` / `data-variant` attributes

Every shadcn primitive sets `data-slot="component-name"` and
`data-variant="..."`. These are how the radix-maia preset's CSS reaches across
component boundaries (`has-data-[slot=card-action]:grid-cols-…` in `CardHeader`).
**Don't remove or rename these data attributes** when editing a primitive.

### `data-icon="inline-start" | "inline-end"` for icons in buttons

The Button cva uses `has-data-[icon=inline-end]:pr-2.5` to tighten padding when
an icon is on the trailing side. Mark icon elements explicitly:

```tsx
<Button>
  <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" strokeWidth={1.8} />
  生成新文章
</Button>
```

### The 3-uses promotion rule

A shared component is born only after the **third** repetition. If
`StatCard` appears once, inline the markup. After the second copy-paste, leave
both copies — they may diverge. After the third, extract.

---

## Styling Patterns

- **Tailwind v4 via `@theme inline`**: theme tokens (colors, fonts, radii) live
  in `src/index.css` under `@theme inline`. To add a new token, add a CSS
  variable in `:root` (and `.dark`), then expose it as `--color-x` /
  `--radius-x` inside the `@theme inline` block.
- **No `tailwind.config.js`** — Tailwind v4 reads its config from CSS.
- **`cn()` from `@/lib/utils`** is the *only* class-merging helper. Don't reach
  for `classnames` or build custom merge logic.
- **Color tokens, not raw colors**: `text-foreground`, `bg-muted`,
  `border-border/60`. Avoid `text-gray-700` / `bg-zinc-200` etc.
- **Semantic colors for status**: `last_response` badges use
  `emerald / sky / amber / rose` directly — these are semantic states, not
  theming. Keep them centralized in the component that owns the mapping
  (e.g. `NextReview.tsx`).
- **`tabular-nums` on every stat number** for stable widths.

---

## Icons

- Library: `@hugeicons/react` + `@hugeicons/core-free-icons` (shipped by the
  preset; the `iconLibrary` field in `components.json` is `hugeicons`).
- Import each icon by name (tree-shaken):
  `import { SparklesIcon } from "@hugeicons/core-free-icons"`.
- Render via `<HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={1.8} />`.
- Default stroke width is `1.8` for inline icons, `2` for emphatic / logo
  surfaces. Keep stroke width consistent within a screen.

---

## Accessibility

- **Icon-only buttons need `aria-label`**: `<Button size="icon-sm" aria-label="打开菜单">`.
- **Use semantic landmarks**: `<header>`, `<main>`, `<nav>`, `<aside>` rather
  than divs with ARIA roles.
- **Lists must be `<ul>` / `<ol>` + `<li>`** even when styled as cards.
- **Sheet titles must exist** (Radix throws a console warning otherwise) — use
  `<SheetTitle className="sr-only">` if the title is visual-only.
- **Focus-visible rings** are wired by the preset (`focus-visible:ring-ring/50`).
  Don't override `outline-none` without restoring a visible focus state.

---

## Common Mistakes

- ❌ Nesting `<a>` inside `<button>` — use `<Button asChild><Link/></Button>`.
- ❌ Removing `data-slot` / `data-variant` from shadcn primitives — the radix-maia
  CSS depends on them.
- ❌ `useEffect` for derived data — compute it inline, memoize only if profiling
  says so.
- ❌ Reaching for `useState` when the value belongs in the URL (filter, sort,
  selection) — see `state-management.md`.
- ❌ Mixing `Inter` / `system-ui` into `font-family` — the preset ships Figtree
  (body) + Geist (heading); use them via `font-sans` and `font-heading`.
