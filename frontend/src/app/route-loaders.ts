/**
 * Dynamic import thunks for the lazy routes, shared between the router (which
 * wraps them in `React.lazy`) and the Sidebar (which calls them to prefetch a
 * route chunk on hover/focus). A dynamic import is keyed by specifier and
 * module-cached, so prefetching here makes the subsequent `lazy()` resolve
 * instantly. Kept in its own module so the Sidebar doesn't have to import the
 * router (which would create a router → AppShell → Sidebar → router cycle).
 */
export const importArticleDetail = () => import("@/pages/ArticleDetail")
export const importArticleNew = () => import("@/pages/ArticleNew")
export const importArticles = () => import("@/pages/Articles")
export const importVocab = () => import("@/pages/Vocab")
export const importVocabWeak = () => import("@/pages/VocabWeak")

/**
 * Maps a nav destination to the import that loads its route chunk. Eager
 * routes (Dashboard) are intentionally omitted — they're already in the
 * initial bundle.
 */
export const routePrefetch: Record<string, () => Promise<unknown>> = {
  "/vocab": importVocab,
  "/vocab/weak": importVocabWeak,
  "/articles": importArticles,
  "/articles/new": importArticleNew,
}
