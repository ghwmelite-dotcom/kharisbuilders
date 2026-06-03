# Phase C1: AI Sermon Assistant (Search + Study Guide) — Design Spec

**Date:** 2026-06-03
**Status:** Approved (design), pending spec review
**Project:** KharisBuilders church website (Astro 6 SSR + Cloudflare D1/R2, gated admin via Cloudflare Access). Sermons are YouTube/Vimeo embeds with metadata (`title, speaker, series, scripture_ref, description, sermon_date, thumbnail_key`).

---

## 1. Purpose & Goals

Help the online congregation **discover** messages by meaning and help members **engage** with them, using Cloudflare's AI stack over the existing sermon content.

**Success criteria**
- A visitor can type a natural query ("sermons about anxiety") on `/sermons` and get semantically ranked results.
- Each sermon detail page shows an AI **study guide** (summary, key points, reflection questions, related scriptures), generated once and cached.
- Quality scales with content: works from title/scripture/description today; richer when a staff-pasted transcript is present.
- AI failure never breaks a page (graceful fallback to the normal list / hidden study-guide section).

**Decisions locked in (from brainstorming)**
- Content source: **metadata + optional transcript** (per-sermon, staff-pasted; AI uses it when present).
- Capabilities for C1: **semantic search + per-sermon study guide**. Conversational Q&A chat is **C2 (deferred)**.
- Surface: **on the sermons pages** (`/sermons` search bar + study-aid section on detail). A dedicated "Ask Kharis" page arrives with C2.

---

## 2. Scope

**In scope (C1):** Workers AI + Vectorize wiring; a `transcript` field; embedding sermons on save + a one-time reindex backfill; semantic search on `/sermons`; per-sermon study guide generation with D1 caching + a progressive-enhancement endpoint; graceful degradation; tests.

**Out of scope (deferred):** conversational RAG chat + dedicated assistant page (C2); transcript chunking for passage-level search; auto-transcription from audio; multilingual translation; per-user history (Phase F accounts).

---

## 3. Cloudflare Infrastructure

- **Workers AI** binding `AI`. Models: embeddings `@cf/baai/bge-base-en-v1.5` (768-dim), generation `@cf/meta/llama-3.1-8b-instruct`.
- **Vectorize** index `kharis-sermons`, **768 dimensions, cosine** metric, binding `SERMONS`. Created via `wrangler vectorize create kharis-sermons --dimensions=768 --metric=cosine`.
- `wrangler.jsonc` gains:
  ```jsonc
  "ai": { "binding": "AI" },
  "vectorize": [{ "binding": "SERMONS", "index_name": "kharis-sermons" }]
  ```
- After adding bindings, regenerate types: `npm run generate-types` (wrangler types) so `env.AI` / `env.SERMONS` are typed.

> **Local-dev caveat:** Astro dev uses `platformProxy` (Miniflare), which does **not** fully support Workers AI / Vectorize. Therefore AI features are verified on the **deployed worker** (or `wrangler dev --remote`), and all logic is unit-tested behind injected clients (so CI/local tests never call real AI). This is reflected in the testing + rollout sections.

---

## 4. Data Model

### Alter `sermons`
Add `transcript TEXT` (nullable; staff-pasted, optional). Included in embedding + study-guide text when present.

### New table `sermon_study_guides`
| column | type | notes |
|--------|------|-------|
| sermon_id | INTEGER PRIMARY KEY | FK → sermons(id) ON DELETE CASCADE |
| content_hash | TEXT NOT NULL | sha-256 of the composed sermon text |
| guide_json | TEXT NOT NULL | `{ summary, key_points[], reflection_questions[], related_scriptures[] }` |
| generated_at | TEXT NOT NULL DEFAULT (datetime('now')) | |

One row per sermon. A guide is reused while `content_hash` matches; when the sermon changes, the hash differs and the guide regenerates (replace the row).

### Vectorize vectors
One vector per sermon, `id = String(sermon.id)`, `values = embed(composedText)`, `metadata = { slug, title, published }`. Search re-fetches the matched ids from D1 and keeps only published sermons (D1 is the source of truth for visibility), preserving Vectorize rank order.

---

## 5. Components & Boundaries

All Workers AI / Vectorize access goes through **injected client interfaces** so pure logic is unit-testable offline.

**Injected clients (`src/lib/ai/clients.ts`)**
```ts
export interface AIClient {
  embed(text: string): Promise<number[]>;          // 768 floats
  generate(messages: { role: string; content: string }[]): Promise<string>;
}
export interface VectorStore {
  upsert(vectors: { id: string; values: number[]; metadata?: Record<string, unknown> }[]): Promise<void>;
  query(values: number[], topK: number): Promise<{ id: string; score: number }[]>;
  remove(ids: string[]): Promise<void>;
}
// Real adapters wrap env.AI.run(...) and env.SERMONS.upsert/query/deleteByIds(...).
export function workersAi(ai: Ai): AIClient;
export function vectorize(index: VectorizeIndex): VectorStore;
```

**Pure logic (`src/lib/ai/`)** — unit-tested:
- `text.ts` — `composeSermonText(sermon)` (title/speaker/series/scripture/description/transcript → one string), `truncate(text, max)` (embed ≤ ~2000 chars; guide ≤ ~6000).
- `hash.ts` — `contentHash(text)` → sha-256 hex (WebCrypto, like the Paystack signature util).
- `study-guide.ts` — `buildStudyGuideMessages(sermon, text)` (system+user messages instructing strict JSON), `parseStudyGuide(raw)` → `{ summary, keyPoints[], reflectionQuestions[], relatedScriptures[] }` with a safe fallback (extract first `{...}`; on failure, `summary = raw.trim()`, arrays empty).
- `search.ts` — `searchSermonIds(deps: { ai: AIClient; store: VectorStore }, query: string, topK)` → ranked id list.
- `index.ts` — `indexSermon(deps: { ai; store }, sermon)` (embed composed text → upsert), `removeSermon(store, id)`.
- `guide-service.ts` — `getOrGenerateGuide(db, ai, sermon)` → cache lookup by (sermon_id, hash); hit → parse cached; miss → generate + parse + upsert cache row; returns the guide object.

**Data access (`src/lib/db/`)**
- `sermons.ts` — add `transcript` to `Sermon`/`SermonFull` + COLS + create/update binds; add `getPublishedSermonsByIds(db, ids)` (returns published rows for a set of ids).
- `study-guides.ts` — `getCachedGuide(db, sermonId)`, `upsertGuide(db, sermonId, hash, json)`, `deleteGuide(db, sermonId)`.

**Routes / pages**
- `src/pages/sermons/index.astro` — add a search `<form method="get">` (`name="q"`). When `q` present: embed → Vectorize query → `getPublishedSermonsByIds` → render ranked (with "results for …" + clear). On any AI error → fallback to a keyword `LIKE` filter over published sermons (or the full list). When absent: existing list.
- `src/pages/sermons/[slug].astro` — add a "Study Guide" section (skeleton) + a small inline script that fetches the endpoint and renders.
- `src/pages/api/ai/study-guide.ts` — `GET ?sermon=<slug>` → load the published sermon → `getOrGenerateGuide` → JSON. (Public; bounded cost because cached per content-version and only for existing published sermons.)
- `src/pages/api/admin/ai/reindex.ts` — gated `POST` → embed + upsert all sermons; returns `{ indexed }`. One-time backfill (and re-runnable).
- `src/pages/api/admin/sermons.ts` — after create/update, **best-effort** (try/catch, never fails the save): `indexSermon` + `deleteGuide(sermonId)` (so the guide regenerates with new content). After delete: `removeSermon` + cascade handles the guide row.

**Admin form**
- `src/components/admin/SermonForm.astro` — add a `transcript` textarea (optional; help text: "Paste the transcript or YouTube captions to improve AI search + study guide").

---

## 6. Data Flow

```
Save sermon (admin) → composeSermonText → contentHash
                    → [best-effort] embed → SERMONS.upsert(id) ; deleteGuide(id)
Reindex (one-time)  → for each sermon: embed → upsert
Search (/sermons?q) → embed(q) → SERMONS.query(topK) → getPublishedSermonsByIds → ranked render
                      (AI error → keyword fallback)
Open sermon page    → render immediately → JS GET /api/ai/study-guide?sermon=slug
                    → cache hit (hash match)? return cached
                    : generate(LLM) → parse → upsertGuide → return  (skeleton until resolved)
```

---

## 7. Error Handling / Graceful Degradation

- **Search:** any failure (embed, Vectorize, empty index) → fall back to a keyword `LIKE` over published sermons; if that also fails → the normal published list. Search never 500s.
- **Study guide:** endpoint returns `{ ok:false }` (or 200 with `available:false`) on generation/parse failure; the page script simply hides the section. No error shown to the visitor.
- **Indexing on save:** wrapped in try/catch — a Vectorize/AI hiccup logs but never blocks the admin save (the DB write already succeeded).
- **Parse safety:** `parseStudyGuide` always returns a valid object (worst case: summary-only), so a chatty LLM response never breaks rendering.
- **Empty/short sermons:** if composed text is too short to be useful, the guide endpoint may return `available:false`; search still works on whatever metadata exists.

---

## 8. Security

- **No secrets added** — Workers AI + Vectorize are bindings, not API keys; nothing reaches the client.
- **Reindex** is admin-gated (`requireAdmin` + Cloudflare Access on `/api/admin/*`).
- **Study-guide endpoint** is public but bounded: only generates for existing **published** sermons, caches per content-hash, so an attacker can't drive unbounded LLM spend (at most one generation per sermon-version). Optional later: light rate-limit.
- **Prompt safety:** sermon text is church-authored (admin-entered), low injection risk; the study-guide prompt instructs JSON-only and we parse defensively. Search embeds the user query but never executes it.
- No PII involved.

---

## 9. Testing Strategy

**Pure unit tests (node vitest, fake clients — no real AI):**
- `text.ts`: composeSermonText includes/omits transcript correctly; truncate bounds.
- `hash.ts`: stable sha-256; changes when text changes (oracle via node:crypto).
- `study-guide.ts`: parseStudyGuide handles clean JSON, fenced ```json, prose fallback, missing keys; buildStudyGuideMessages includes the sermon text + JSON instruction.
- `search.ts`: `searchSermonIds` embeds the query and maps Vectorize results to ordered ids (fake AIClient/VectorStore assert calls + ordering).
- `index.ts`: `indexSermon` embeds composed text and upserts `{id, values, metadata}` (fake store captures args).

**D1 (Miniflare) tests:**
- `study-guides.ts`: upsert/get/delete; `getOrGenerateGuide` cache hit (no AI call) vs miss (AI called once, row written); regeneration when hash changes.
- `sermons.ts`: `getPublishedSermonsByIds` returns published rows for an id set, drops unpublished/missing.

**Live verification (deployed worker / `wrangler dev --remote`):** create the Vectorize index → deploy → `POST /api/admin/ai/reindex` → `/sermons?q=faith` returns ranked results → open a sermon → study guide renders + is cached (second load instant). Add a transcript to one sermon → guide regenerates.

Migrations auto-applied by the harness; the AI/Vectorize bindings are never imported in tests.

---

## 10. Rollout

1. Build + unit-test behind injected fakes (no keys/bindings needed); build green.
2. `wrangler vectorize create kharis-sermons --dimensions=768 --metric=cosine`; add `ai` + `vectorize` to `wrangler.jsonc`; `npm run generate-types`.
3. Apply migrations (transcript + study-guides) local + remote.
4. Deploy. Run the gated **reindex** once to backfill existing sermons.
5. Verify search + study guide on the live site; paste a transcript into one sermon and confirm the guide sharpens.

---

## 11. Open Questions (resolved defaults)
- Embedding model `bge-base-en-v1.5` (768-dim); generation `llama-3.1-8b-instruct`. Swappable in the adapter if quality/cost warrants.
- Embed input truncated to ~2000 chars; guide input to ~6000 (covers metadata + transcript head). Passage-level chunking deferred to C2.
- Study guide shape: summary + key points + reflection questions + related scriptures. Fixed for v1.
- Search topK = 12; below a minimum score we still show results (semantic search rarely returns nothing useful); empty index → keyword fallback.
