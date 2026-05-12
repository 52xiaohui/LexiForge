import type {
  Article,
  ArticleDetail,
  ArticleWord,
  CefrLevel,
  GenerateArticleInput,
  GenerationPreview,
  LastResponse,
  TodayProgress,
  VocabSummary,
  VocabWord,
} from "@/types/api"

// --------------------------------------------------------------------------------
// Mutable mock store
//
// The prototype is wired through TanStack Query so the queryFn / mutationFn
// boundary is real. Seeds below are generated once on module init. Mutations
// (e.g. deleteArticle, markArticleRead) update the store in-place; Query
// consumers call invalidateQueries to re-read.
// --------------------------------------------------------------------------------

// ---- Vocab seeds ---------------------------------------------------------------

interface RawWord {
  spelling: string
  translation: string
  last_response: LastResponse
  study_count: number
  tags: string[]
  mastery_score: number
  weak_score: number
  days_to_review: number
  /** Optional example sentence to showcase in the reader popover. */
  example?: string
}

const WORD_SEEDS: RawWord[] = [
  { spelling: "ephemeral", translation: "短暂的", last_response: "FORGET", study_count: 14, tags: ["STICKING"], mastery_score: 0, weak_score: 164, days_to_review: 0, example: "The beauty of a sunset is ephemeral — a few minutes and it's gone." },
  { spelling: "ubiquitous", translation: "普遍存在的", last_response: "VAGUE", study_count: 9, tags: [], mastery_score: 12, weak_score: 142, days_to_review: 0, example: "Smartphones are now ubiquitous in urban life." },
  { spelling: "candor", translation: "坦率", last_response: "FORGET", study_count: 6, tags: ["STICKING"], mastery_score: 3, weak_score: 138, days_to_review: 1, example: "She answered the interviewer with refreshing candor." },
  { spelling: "vicarious", translation: "替代的；感同身受的", last_response: "VAGUE", study_count: 7, tags: [], mastery_score: 18, weak_score: 121, days_to_review: 1, example: "He took vicarious pleasure in his daughter's success." },
  { spelling: "perfunctory", translation: "敷衍的", last_response: "FAMILIAR", study_count: 11, tags: [], mastery_score: 42, weak_score: 108, days_to_review: 2, example: "He gave a perfunctory nod and walked on." },
  { spelling: "equanimity", translation: "镇定；平静", last_response: "FORGET", study_count: 5, tags: ["STICKING"], mastery_score: 4, weak_score: 126, days_to_review: 0, example: "She accepted the bad news with surprising equanimity." },
  { spelling: "ascertain", translation: "查明；确定", last_response: "VAGUE", study_count: 8, tags: [], mastery_score: 22, weak_score: 104, days_to_review: 1, example: "The police are trying to ascertain the cause of the fire." },
  { spelling: "quintessential", translation: "典型的；精髓的", last_response: "VAGUE", study_count: 6, tags: [], mastery_score: 20, weak_score: 112, days_to_review: 2, example: "He is the quintessential English gentleman." },
  { spelling: "gregarious", translation: "爱社交的", last_response: "FAMILIAR", study_count: 12, tags: [], mastery_score: 48, weak_score: 92, days_to_review: 3, example: "Gregarious people tend to thrive in open-plan offices." },
  { spelling: "serendipity", translation: "意外收获", last_response: "FORGET", study_count: 4, tags: ["STICKING"], mastery_score: 2, weak_score: 154, days_to_review: 0, example: "Meeting her was pure serendipity." },
  { spelling: "pragmatic", translation: "务实的", last_response: "FAMILIAR", study_count: 15, tags: [], mastery_score: 60, weak_score: 76, days_to_review: 4, example: "A pragmatic approach will save time in the long run." },
  { spelling: "mitigate", translation: "减轻", last_response: "VAGUE", study_count: 10, tags: [], mastery_score: 30, weak_score: 96, days_to_review: 2, example: "Insurance can mitigate the financial impact of an accident." },
  { spelling: "juxtapose", translation: "并置；对比", last_response: "FORGET", study_count: 5, tags: ["STICKING"], mastery_score: 6, weak_score: 132, days_to_review: 1, example: "The exhibition juxtaposes ancient pottery with modern sculpture." },
  { spelling: "cognizant", translation: "认识到的", last_response: "VAGUE", study_count: 7, tags: [], mastery_score: 18, weak_score: 110, days_to_review: 2, example: "We are cognizant of the risks involved." },
  { spelling: "ameliorate", translation: "改善", last_response: "FORGET", study_count: 6, tags: [], mastery_score: 8, weak_score: 116, days_to_review: 1, example: "Small reforms will not ameliorate the larger problem." },
  { spelling: "tenuous", translation: "脆弱的；薄弱的", last_response: "FAMILIAR", study_count: 9, tags: [], mastery_score: 44, weak_score: 88, days_to_review: 3, example: "The evidence against her is tenuous at best." },
  { spelling: "esoteric", translation: "深奥的", last_response: "VAGUE", study_count: 5, tags: [], mastery_score: 16, weak_score: 118, days_to_review: 2, example: "Her tastes in music are rather esoteric." },
  { spelling: "propensity", translation: "倾向", last_response: "FAMILIAR", study_count: 11, tags: [], mastery_score: 50, weak_score: 82, days_to_review: 3, example: "He has a propensity for exaggeration." },
  { spelling: "incessant", translation: "不断的", last_response: "WELL_FAMILIAR", study_count: 18, tags: [], mastery_score: 82, weak_score: 28, days_to_review: 6, example: "The incessant noise kept her awake all night." },
  { spelling: "lucid", translation: "清晰的", last_response: "WELL_FAMILIAR", study_count: 20, tags: [], mastery_score: 90, weak_score: 20, days_to_review: 7, example: "His explanation was admirably lucid." },
  { spelling: "meticulous", translation: "一丝不苟的", last_response: "FAMILIAR", study_count: 14, tags: [], mastery_score: 58, weak_score: 74, days_to_review: 4, example: "She is meticulous in keeping her financial records." },
  { spelling: "ostensible", translation: "表面上的", last_response: "VAGUE", study_count: 6, tags: ["STICKING"], mastery_score: 14, weak_score: 120, days_to_review: 1, example: "The ostensible reason for his visit was business." },
  { spelling: "prolific", translation: "多产的", last_response: "WELL_FAMILIAR", study_count: 16, tags: [], mastery_score: 78, weak_score: 34, days_to_review: 5, example: "She was a prolific author of short stories." },
  { spelling: "scrutinize", translation: "仔细检查", last_response: "FAMILIAR", study_count: 13, tags: [], mastery_score: 54, weak_score: 78, days_to_review: 4, example: "Auditors scrutinize every line of the report." },
  { spelling: "surreptitious", translation: "偷偷的", last_response: "FORGET", study_count: 4, tags: ["STICKING"], mastery_score: 5, weak_score: 148, days_to_review: 0, example: "He took a surreptitious look at his phone under the table." },
  { spelling: "tacit", translation: "心照不宣的", last_response: "FAMILIAR", study_count: 10, tags: [], mastery_score: 46, weak_score: 84, days_to_review: 3, example: "They had a tacit agreement not to mention the subject again." },
  { spelling: "unfettered", translation: "无拘束的", last_response: "VAGUE", study_count: 5, tags: [], mastery_score: 18, weak_score: 106, days_to_review: 2, example: "The writer enjoyed unfettered creative freedom." },
  { spelling: "verbose", translation: "啰嗦的", last_response: "WELL_FAMILIAR", study_count: 17, tags: [], mastery_score: 80, weak_score: 26, days_to_review: 6, example: "His verbose explanations put the class to sleep." },
  { spelling: "whimsical", translation: "异想天开的", last_response: "FAMILIAR", study_count: 12, tags: [], mastery_score: 52, weak_score: 80, days_to_review: 3, example: "The movie has a whimsical, dreamlike quality." },
  { spelling: "zealous", translation: "热心的", last_response: "WELL_FAMILIAR", study_count: 19, tags: [], mastery_score: 85, weak_score: 24, days_to_review: 7, example: "She's a zealous advocate for environmental protection." },
  { spelling: "benevolent", translation: "仁慈的", last_response: "FAMILIAR", study_count: 13, tags: [], mastery_score: 56, weak_score: 72, days_to_review: 4, example: "The king was a benevolent ruler, loved by his people." },
  { spelling: "capricious", translation: "反复无常的", last_response: "VAGUE", study_count: 7, tags: [], mastery_score: 22, weak_score: 102, days_to_review: 2, example: "The weather in spring is famously capricious." },
  { spelling: "diligent", translation: "勤奋的", last_response: "WELL_FAMILIAR", study_count: 22, tags: [], mastery_score: 92, weak_score: 16, days_to_review: 8, example: "Diligent students usually score well." },
  { spelling: "eloquent", translation: "雄辩的", last_response: "FAMILIAR", study_count: 14, tags: [], mastery_score: 60, weak_score: 70, days_to_review: 4, example: "Her eloquent speech moved the whole room." },
  { spelling: "frugal", translation: "节俭的", last_response: "WELL_FAMILIAR", study_count: 21, tags: [], mastery_score: 88, weak_score: 22, days_to_review: 7, example: "My grandparents were frugal with everything, even paper." },
  { spelling: "garrulous", translation: "话多的", last_response: "VAGUE", study_count: 6, tags: [], mastery_score: 20, weak_score: 100, days_to_review: 2, example: "The garrulous taxi driver never stopped talking." },
  { spelling: "hackneyed", translation: "陈腐的", last_response: "FORGET", study_count: 3, tags: ["STICKING"], mastery_score: 6, weak_score: 144, days_to_review: 0, example: "The plot is full of hackneyed clichés." },
  { spelling: "immutable", translation: "不变的", last_response: "FAMILIAR", study_count: 11, tags: [], mastery_score: 50, weak_score: 82, days_to_review: 3, example: "The laws of physics are considered immutable." },
  { spelling: "judicious", translation: "明智的", last_response: "FAMILIAR", study_count: 12, tags: [], mastery_score: 55, weak_score: 76, days_to_review: 4, example: "A judicious use of colour made the room feel warmer." },
  { spelling: "laconic", translation: "简洁的", last_response: "VAGUE", study_count: 6, tags: [], mastery_score: 18, weak_score: 108, days_to_review: 2, example: "His laconic reply surprised the reporter." },
]

function formatDayOffset(offset: number): string {
  const now = new Date("2026-05-12T00:00:00+08:00")
  const next = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000)
  return next.toISOString()
}

function buildWord(seed: RawWord, index: number): VocabWord {
  return {
    id: `w_${String(index + 1).padStart(3, "0")}`,
    spelling: seed.spelling,
    translation: seed.translation,
    last_response: seed.last_response,
    study_count: seed.study_count,
    tags: seed.tags,
    mastery_score: seed.mastery_score,
    weak_score: seed.weak_score,
    next_study_date: formatDayOffset(seed.days_to_review),
    example_sentence: seed.example,
    recently_covered_count: 0,
    mastered: false,
    ignored: false,
  }
}

const words: VocabWord[] = WORD_SEEDS.map(buildWord)
const wordBySpelling = new Map(words.map((w) => [w.spelling, w]))

// ---- Article seeds -------------------------------------------------------------

interface RawArticleDetail {
  id: string
  title: string
  topic: string
  difficulty: CefrLevel | "B1-B2"
  article_length: Article["article_length"]
  target_word_count: number
  hours_ago: number
  body: string
  targetSpellings: string[]
  coverageOverride?: number
  read?: boolean
}

const articleSeeds: RawArticleDetail[] = [
  {
    id: "art_01",
    title: "The Ephemeral Nature of Modern Attention",
    topic: "technology and society",
    difficulty: "B2",
    article_length: "medium",
    target_word_count: 6,
    hours_ago: 6,
    body:
      "Modern attention feels increasingly ephemeral. Scrolling through feeds, we rarely " +
      "pause long enough to ascertain what a story really means. The apps are ubiquitous — " +
      "on our phones, tablets, even our watches — and they reward us for moving on rather " +
      "than lingering. Good writers once wrote with candor; now many craft pieces in a " +
      "perfunctory style, optimizing for clicks. What gets lost is equanimity, that quiet " +
      "state of mind where ideas can actually land.",
    targetSpellings: [
      "ephemeral",
      "ascertain",
      "ubiquitous",
      "candor",
      "perfunctory",
      "equanimity",
    ],
    read: false,
  },
  {
    id: "art_02",
    title: "A Candid Letter to a Future Self",
    topic: "personal growth",
    difficulty: "B1",
    article_length: "short",
    target_word_count: 4,
    hours_ago: 20,
    body:
      "If I had to write you a candid letter, I'd say: be pragmatic, but never let the " +
      "practical swallow the whimsical. Notice when a choice feels tenuous, and give " +
      "yourself room to ameliorate it. You are allowed to change your mind.",
    targetSpellings: ["pragmatic", "whimsical", "tenuous", "ameliorate"],
    read: true,
  },
  {
    id: "art_03",
    title: "Ubiquitous Sensors and the Quiet Cities",
    topic: "technology and society",
    difficulty: "C1",
    article_length: "long",
    target_word_count: 8,
    hours_ago: 46,
    body:
      "Ubiquitous sensors have begun to reshape our cities in ways that are both subtle " +
      "and profound. The benefits are quintessential — safer streets, smoother traffic, " +
      "and a more efficient allocation of public resources — but the risks are tenuous and " +
      "difficult to scrutinize. When surveillance becomes surreptitious, even a cognizant " +
      "citizen may find it hard to mitigate its effects. A tacit agreement emerges between " +
      "governments and technology providers, and the propensity to resist quietly erodes.",
    targetSpellings: [
      "ubiquitous",
      "quintessential",
      "tenuous",
      "scrutinize",
      "surreptitious",
      "cognizant",
      "mitigate",
      "tacit",
    ],
    read: true,
  },
  {
    id: "art_04",
    title: "On Stoicism in a Bustling Era",
    topic: "philosophy",
    difficulty: "B2",
    article_length: "medium",
    target_word_count: 5,
    hours_ago: 68,
    body:
      "Stoicism offers a meticulous recipe for equanimity in a noisy world. Its benevolent " +
      "wisdom is lucid: you cannot control the event, only your response. When the mind " +
      "stays lucid, propensity toward panic fades and you act with purpose.",
    targetSpellings: ["meticulous", "equanimity", "benevolent", "lucid", "propensity"],
    read: true,
  },
  {
    id: "art_05",
    title: "Why We Procrastinate (And Sometimes Don't)",
    topic: "psychology",
    difficulty: "B1",
    article_length: "short",
    target_word_count: 4,
    hours_ago: 92,
    body:
      "We often assume procrastination is simply laziness. The reality is more esoteric: we " +
      "delay when a task feels incessant, when its value is tenuous, or when the cost of " +
      "getting started feels capricious. Naming the feeling is the first step to changing " +
      "it.",
    targetSpellings: ["esoteric", "incessant", "tenuous", "capricious"],
    read: true,
  },
  {
    id: "art_06",
    title: "The Prolific Mind and Its Limits",
    topic: "creativity",
    difficulty: "B2",
    article_length: "medium",
    target_word_count: 5,
    hours_ago: 132,
    body:
      "A prolific writer is not necessarily a verbose one. The best are eloquent without " +
      "being hackneyed, diligent without being frugal with ideas, and judicious about when " +
      "to stop.",
    targetSpellings: ["prolific", "verbose", "eloquent", "diligent", "judicious"],
    read: true,
  },
  {
    id: "art_07",
    title: "Laconic Wit in the Age of Verbosity",
    topic: "communication",
    difficulty: "C1",
    article_length: "medium",
    target_word_count: 3,
    hours_ago: 180,
    body:
      "A laconic reply often lands harder than a garrulous one. True wit is unfettered by " +
      "the need to fill silence.",
    targetSpellings: ["laconic", "garrulous", "unfettered"],
    read: true,
  },
  {
    id: "art_08",
    title: "Juxtapose, Don't Compare",
    topic: "thinking",
    difficulty: "B2",
    article_length: "short",
    target_word_count: 3,
    hours_ago: 240,
    body:
      "To juxtapose is not to rank. It is to place two ideas side by side and become " +
      "cognizant of their subtle differences. The immutable rule of good thinking is to see " +
      "clearly before judging.",
    targetSpellings: ["juxtapose", "cognizant", "immutable"],
    read: true,
  },
]

function buildArticleDetail(seed: RawArticleDetail): ArticleDetail {
  const words_ = buildArticleWords(seed.body, seed.targetSpellings)
  const covered = seed.coverageOverride ?? words_.filter((w) => w.is_covered).length
  const coverageRate = seed.target_word_count > 0 ? covered / seed.target_word_count : 0
  return {
    id: seed.id,
    title: seed.title,
    topic: seed.topic,
    difficulty: seed.difficulty,
    article_length: seed.article_length,
    target_word_count: seed.target_word_count,
    covered_word_count: covered,
    coverage_rate: Number(coverageRate.toFixed(4)),
    created_at: new Date(Date.now() - seed.hours_ago * 60 * 60 * 1000).toISOString(),
    content_markdown: seed.body,
    article_words: words_,
    read: seed.read ?? false,
  }
}

/**
 * Walk the body by Unicode code points, case-insensitively locating each
 * target spelling at a word boundary, and return the ArticleWord rows the
 * backend would produce. `is_covered` is true for every located target in the
 * seed. Targets that can't be found stay as `is_covered: false` entries with
 * char_offset = -1.
 */
function buildArticleWords(body: string, spellings: string[]): ArticleWord[] {
  const codepoints = Array.from(body)
  const lower = codepoints.map((c) => c.toLowerCase())
  const results: ArticleWord[] = []
  const wordChar = /[A-Za-z'-]/

  for (const spelling of spellings) {
    const target = Array.from(spelling.toLowerCase())
    let offset = -1
    for (let i = 0; i + target.length <= lower.length; i++) {
      let match = true
      for (let j = 0; j < target.length; j++) {
        if (lower[i + j] !== target[j]) {
          match = false
          break
        }
      }
      if (!match) continue
      const leftOk = i === 0 || !wordChar.test(codepoints[i - 1])
      const rightIdx = i + target.length
      const rightOk =
        rightIdx >= codepoints.length || !wordChar.test(codepoints[rightIdx])
      if (leftOk && rightOk) {
        offset = i
        break
      }
    }
    const wordId = wordBySpelling.get(spelling)?.id ?? `t_${spelling}`
    const translation = wordBySpelling.get(spelling)?.translation ?? ""
    results.push({
      word_id: wordId,
      spelling,
      translation,
      char_offset: offset,
      char_length: target.length,
      is_covered: offset >= 0,
    })
  }
  return results
}

const articleDetails: ArticleDetail[] = articleSeeds.map(buildArticleDetail)

// ---- Back-fill recently_covered_count --------------------------------------
// Each article that "covered" a word bumps the word's recent count, for
// sessions within ~5 days. Approximates the backend's 30-day window.

{
  const now = Date.now()
  const windowMs = 5 * 24 * 60 * 60 * 1000
  for (const article of articleDetails) {
    const createdAt = new Date(article.created_at).getTime()
    if (now - createdAt > windowMs) continue
    for (const aw of article.article_words) {
      if (!aw.is_covered) continue
      const word = wordBySpelling.get(aw.spelling)
      if (!word) continue
      word.recently_covered_count = (word.recently_covered_count ?? 0) + 1
    }
  }
}

// ---- Accessors ----------------------------------------------------------------

function toListItem(detail: ArticleDetail): Article {
  const {
    content_markdown: _ignoredBody,
    article_words: _ignoredWords,
    ...rest
  } = detail
  void _ignoredBody
  void _ignoredWords
  return rest
}

const EMPTY_RESPONSE_COUNTS: Record<LastResponse, number> = {
  FORGET: 0,
  VAGUE: 0,
  FAMILIAR: 0,
  WELL_FAMILIAR: 0,
}

/**
 * Approximate the backend's 70 / 20 / 10 pick (FORGET / VAGUE / FAMILIAR)
 * from the weak pool. Used by the ArticleNew workbench to preview the plan
 * before the user hits "生成".
 */
function autoPickFromWeakPool(n: number): VocabWord[] {
  const pool = words
    .filter((w) => !w.mastered && !w.ignored && w.weak_score >= 80)
    .slice()
    .sort((a, b) => b.weak_score - a.weak_score)

  if (pool.length === 0 || n <= 0) return []

  const forget = pool.filter((w) => w.last_response === "FORGET")
  const vague = pool.filter((w) => w.last_response === "VAGUE")
  const familiar = pool.filter((w) => w.last_response === "FAMILIAR")

  const targetForget = Math.round(n * 0.7)
  const targetVague = Math.round(n * 0.2)
  const targetFamiliar = n - targetForget - targetVague

  const picks: VocabWord[] = []
  picks.push(...forget.slice(0, targetForget))
  picks.push(...vague.slice(0, targetVague))
  picks.push(...familiar.slice(0, Math.max(0, targetFamiliar)))

  // Top up from whatever's left if the quotas didn't fill.
  if (picks.length < n) {
    const seen = new Set(picks.map((p) => p.id))
    for (const w of pool) {
      if (picks.length >= n) break
      if (!seen.has(w.id)) picks.push(w)
    }
  }
  return picks.slice(0, n)
}

export const mockStore = {
  vocabSummary(): VocabSummary {
    const baselineTotal = 1245
    const baselineWeak = 52
    const activeWeak = words.filter(
      (w) => !w.mastered && !w.ignored && w.weak_score >= 80,
    ).length
    return {
      total: baselineTotal,
      weak: activeWeak + baselineWeak,
      last_synced_at: "2026-05-12T07:42:18+08:00",
    }
  },
  todayProgress(): TodayProgress {
    return { practiced: 12, target: 30 }
  },
  listWords(): VocabWord[] {
    return words.slice()
  },
  listWeakWords(): VocabWord[] {
    return words
      .filter((w) => !w.mastered && !w.ignored && w.weak_score >= 80)
      .slice()
      .sort((a, b) => b.weak_score - a.weak_score)
  },
  listRecentArticles(limit = 5): Article[] {
    return articleDetails
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, limit)
      .map(toListItem)
  },
  listArticles(): Article[] {
    return articleDetails
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .map(toListItem)
  },
  getArticle(id: string): ArticleDetail | null {
    return articleDetails.find((a) => a.id === id) ?? null
  },
  firstUnreadArticle(): Article | null {
    const sorted = articleDetails
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    const unread = sorted.find((a) => !a.read)
    return unread ? toListItem(unread) : null
  },
  markArticleRead(id: string): boolean {
    const detail = articleDetails.find((a) => a.id === id)
    if (!detail) return false
    detail.read = true
    return true
  },
  markWordMastered(id: string, mastered: boolean): boolean {
    const word = words.find((w) => w.id === id)
    if (!word) return false
    word.mastered = mastered
    if (mastered) word.ignored = false
    return true
  },
  toggleWordIgnored(id: string, ignored: boolean): boolean {
    const word = words.find((w) => w.id === id)
    if (!word) return false
    word.ignored = ignored
    if (ignored) word.mastered = false
    return true
  },
  nextReview(limit = 5): VocabWord[] {
    return words
      .filter((w) => !w.mastered && !w.ignored && w.weak_score >= 90)
      .slice()
      .sort((a, b) => b.weak_score - a.weak_score)
      .slice(0, limit)
  },
  deleteArticle(id: string): boolean {
    const idx = articleDetails.findIndex((a) => a.id === id)
    if (idx === -1) return false
    articleDetails.splice(idx, 1)
    return true
  },
  /**
   * Build the pre-generation plan the workbench shows to the user. If
   * `selectedIds` is empty, the plan is fully auto from the weak pool. Else
   * the plan uses selected IDs and auto-fills the remainder.
   */
  generationPreview(
    selectedIds: string[],
    targetCount: number,
  ): GenerationPreview {
    const idSet = new Set(selectedIds)
    const picked = selectedIds
      .map((id) => words.find((w) => w.id === id))
      .filter((w): w is VocabWord => Boolean(w))

    const remaining = Math.max(0, targetCount - picked.length)
    const autoFillPool = words.filter(
      (w) =>
        !idSet.has(w.id) &&
        !w.mastered &&
        !w.ignored &&
        w.weak_score >= 80,
    )
    const auto = autoPickFromWeakPool(remaining).filter((w) =>
      autoFillPool.some((p) => p.id === w.id),
    )

    const plan = [...picked, ...auto].slice(0, targetCount)
    const counts = { ...EMPTY_RESPONSE_COUNTS }
    let sticking = 0
    for (const w of plan) {
      counts[w.last_response] = (counts[w.last_response] ?? 0) + 1
      if (w.tags.includes("STICKING")) sticking += 1
    }
    return {
      words: plan,
      counts_by_response: counts,
      sticking_count: sticking,
      auto_fill_count: Math.max(0, plan.length - picked.length),
      is_auto: picked.length === 0,
    }
  },
  /**
   * Simulate POST /articles/generate. If `simulate_failure` is set we throw
   * so the workbench can demo its failure branch. Otherwise we clone a seed
   * article and return the new id.
   */
  generateArticle(input: GenerateArticleInput): { article_id: string } {
    if (input.simulate_failure) {
      throw new Error(
        "模型暂时没有响应，请稍后再试。（模拟失败：切换真实 API 后会展示后端错误信息）",
      )
    }
    const seed =
      articleDetails.find((a) =>
        a.topic.toLowerCase().includes(input.topic.toLowerCase()),
      ) ?? articleDetails[0]
    if (!seed) {
      throw new Error("no seed available to synthesize mock article")
    }
    const nextIndex = articleDetails.length + 1
    const id = `art_${String(nextIndex).padStart(2, "0")}`
    const newDetail: ArticleDetail = {
      ...seed,
      id,
      title: `${seed.title} · 新一版`,
      topic: input.topic,
      difficulty: input.difficulty,
      article_length: input.article_length,
      target_word_count: input.target_word_count,
      covered_word_count: seed.article_words.filter((w) => w.is_covered).length,
      coverage_rate: seed.coverage_rate,
      created_at: new Date().toISOString(),
      article_words: seed.article_words.map((w) => ({ ...w })),
      content_markdown: seed.content_markdown,
      read: false,
    }
    articleDetails.unshift(newDetail)
    // Bump recent-coverage counts on the plan so the VocabWeak "最近覆盖"
    // column reacts to new generations.
    for (const aw of newDetail.article_words) {
      if (!aw.is_covered) continue
      const word = words.find((w) => w.id === aw.word_id)
      if (!word) continue
      word.recently_covered_count = (word.recently_covered_count ?? 0) + 1
    }
    return { article_id: id }
  },
}
