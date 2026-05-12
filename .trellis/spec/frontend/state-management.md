# State Management

> How state is managed in this project.

---

## Overview

Three state categories, three different homes. **No** Redux, Zustand, Jotai,
Recoil, MobX, or React Context for global app state — TanStack Query covers
server cache, React Router covers navigation/URL state, `useState` covers
local UI state. Adding a fourth layer needs an explicit reason in the task PRD.

---

## State Categories

| Category | Home | Examples |
|---|---|---|
| **Server state** | TanStack Query | vocab summary, weak words, articles, sync status |
| **URL state** | React Router (search params, route params) | `?target_word_ids=…`, `/articles/:id`, filters, sort, pagination |
| **Local UI state** | `useState` / `useReducer` | sheet open/closed, hover, transient form input |
| **Theme** | `ThemeProvider` context (preset-shipped) | light/dark/system |

---

## Server State (TanStack Query)

### Where the client lives

`QueryClient` is instantiated once in `src/app/providers.tsx` and provided via
`QueryClientProvider`. Use `useQuery` / `useMutation` from anywhere below it.

```tsx
// src/app/providers.tsx
const [queryClient] = useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
      },
    }),
)
```

### Query key conventions

Keys are arrays: `[domain, resource, ...params]`. They serialize to the cache
identifier and are how `invalidateQueries` matches.

| Domain | Example key | Meaning |
|---|---|---|
| vocab | `["vocab", "summary"]` | Vocab summary |
| vocab | `["vocab", "weak", { sort, filter }]` | Filtered weak word list |
| vocab | `["vocab", "next-review"]` | Suggested review words |
| articles | `["articles", "recent"]` | Recent article list |
| articles | `["articles", articleId]` | Single article |
| progress | `["progress", "today"]` | Today's practice progress |

Rules:
- **Domain first**, then resource, then params object.
- **Params object always last** so partial invalidations work
  (`invalidateQueries({ queryKey: ["vocab"] })` clears everything vocab-related).
- **No string concatenation** in keys (`"vocab-weak-${id}"` breaks partial match).

### Prototype mock pattern

The MVP prototype uses `queryFn: async () => mockX` — a literal pass-through to
the typed mock in `lib/mock-data.ts`. This wires every page through Query so
the next task only swaps the `queryFn` to a real `fetch`:

```tsx
// today (prototype)
useQuery({ queryKey: ["vocab", "summary"], queryFn: async () => mockVocabSummary })

// next task (real API)
useQuery({
  queryKey: ["vocab", "summary"],
  queryFn: () => fetch("/api/v1/vocab/summary").then((r) => r.json()),
})
```

### Mutations

Mutations should `invalidateQueries` for the keys they touch, not call
`setQueryData` unless you're optimistically updating:

```tsx
const queryClient = useQueryClient()
const generate = useMutation({
  mutationFn: (input: GenerateArticleInput) => api.generateArticle(input),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["articles"] })
  },
})
```

---

## URL State

React Router v7 is the source of truth for anything navigable. Anything a user
should be able to **bookmark / share / refresh** lives in the URL, not in state.

### Route params

Defined in `app/router.tsx`. Read via `useParams<{ id: string }>()`.

### Search params

Use `useSearchParams()`. The `?target_word_ids=uuid-1,uuid-2` pattern from
`docs/06-frontend.md` is a comma-joined list — parse on read, serialize on write.

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const ids = (searchParams.get("target_word_ids") ?? "").split(",").filter(Boolean)
```

### Route handles

Per-route metadata (page title, subtitle) attaches to the route via `handle`:

```tsx
{
  path: "dashboard",
  element: <Dashboard />,
  handle: { title: "总览", subtitle: "你的学习健康度" } satisfies RouteHandle,
}
```

`TopBar` reads it via `useMatches().at(-1)?.handle`. This keeps page titles in
sync with routes — never hardcode the title twice.

---

## Local UI State

`useState` for everything ephemeral:

- Drawer / dialog open state
- Hover / focus visual state (only when needed beyond CSS)
- Form input *before* it's submitted (after submit → URL or server)
- Tab selection within a single render boundary

If two sibling components share state, **lift it to the nearest parent**. If
three+ levels need it, **first try moving the state to the URL** before
reaching for context.

---

## When You Think You Need Global State

Before adding any global store, ask:

1. **Can this go in the URL?** (Filters, selection, pagination → yes.)
2. **Can this be a server query?** (Current user, settings → yes once we have
   `/auth/me`.)
3. **Can it live in the nearest common parent?** (Most things → yes.)

If the answer is still no after those three — write a short note in the task PRD
explaining why, then introduce the smallest possible solution (likely React
Context with a single provider, not a third-party store).

---

## Common Mistakes

- ❌ Storing a fetched object in `useState` instead of `useQuery` — you lose
  cache, retry, dedup, and stale-while-revalidate.
- ❌ Reading the URL via `window.location` — use `useLocation` /
  `useSearchParams` so React re-renders correctly.
- ❌ Two cache keys for the same resource (e.g. `["weak"]` vs `["vocab", "weak"]`).
  Invalidating one leaves the other stale.
- ❌ `staleTime: Infinity` for everything to "avoid refetches" — kills the
  freshness benefit; tune per-query when needed.
- ❌ Mutating mock data directly to "simulate" updates. Mocks are read-only;
  wire the mutation through Query and let `invalidateQueries` re-read.
