# Phase C1: AI Sermon Assistant (Search + Study Guide) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add semantic sermon search on `/sermons` and an AI study guide on each sermon page, built on Workers AI + Vectorize, with all logic behind injected clients so it's unit-tested offline and verified live.

**Architecture:** Workers AI (`AI`: bge embeddings + llama generation) and a Vectorize index (`SERMONS`) are reached through thin structural adapters; pure logic (text composition, hashing, prompt building, JSON parsing, search/index orchestration, cache) takes injected `AIClient`/`VectorStore` and is fully tested with fakes (+ Miniflare D1). Sermons embed on save (best-effort) and via a one-time reindex; search embeds the query → Vectorize → D1 rows (keyword fallback); study guides generate once and cache in D1.

**Tech Stack:** Astro 6 SSR, Cloudflare Workers AI + Vectorize + D1, Vitest + Miniflare. Spec: `docs/superpowers/specs/2026-06-03-ai-sermon-assistant-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (branch `feat/phaseC1-ai-sermons` off `main`).

> **Conventions (verified):** `env` from `src/lib/runtime` (never imported in tests). D1 enforces FKs under Miniflare; harness applies every `migrations/*.sql`. WebCrypto available (used for HMAC in `paystack/signature.ts`). Sermons: `src/lib/db/sermons.ts` (`Sermon`, COLS, getSermonBySlug/getSermonById, create/update). Admin sermon route `src/pages/api/admin/sermons.ts` already captures `targetId` and does best-effort image upload — index-on-save follows the same pattern. **AI/Vectorize do NOT work under Astro local dev (Miniflare platformProxy); verify on the deployed worker.**

---

## File Structure (created/modified)

```
wrangler.jsonc                              # +ai +vectorize bindings
migrations/0012_sermon_transcript.sql       # sermons.transcript
migrations/0013_sermon_study_guides.sql     # cache table

src/lib/ai/clients.ts                        # AIClient/VectorStore interfaces + workersAi()/vectorize() adapters
src/lib/ai/text.ts                           # composeSermonText / truncate
src/lib/ai/hash.ts                           # contentHash (sha-256)
src/lib/ai/study-guide.ts                    # buildStudyGuideMessages / parseStudyGuide
src/lib/ai/search.ts                         # searchSermonIds
src/lib/ai/index-sermon.ts                   # indexSermon / removeSermon
src/lib/ai/guide-service.ts                  # getOrGenerateGuide (cache + generate)
src/lib/db/sermons.ts                        # +transcript; +getPublishedSermonsByIds; +searchSermonsKeyword; +listAllSermonIds
src/lib/db/study-guides.ts                   # getCachedGuide / upsertGuide / deleteGuide

src/pages/api/ai/study-guide.ts              # GET ?sermon=slug
src/pages/api/admin/ai/reindex.ts            # gated POST backfill
src/pages/api/admin/sermons.ts               # best-effort index-on-save / remove-on-delete
src/pages/sermons/index.astro                # search bar + semantic results
src/pages/sermons/[slug].astro               # study-guide section + fetch script
src/components/admin/SermonForm.astro        # transcript textarea

tests/ai/text.test.ts
tests/ai/hash.test.ts
tests/ai/study-guide.test.ts
tests/ai/search.test.ts
tests/ai/index-sermon.test.ts
tests/ai/guide-service.test.ts
tests/db/sermons-ai.test.ts
```

---

## Task 1: bindings config + Vectorize index + types

**Files:** Modify `wrangler.jsonc`.

- [ ] **Step 1: Add `ai` + `vectorize` to `wrangler.jsonc`** (after the `kv_namespaces` array, inside the root object)

```jsonc
	"kv_namespaces": [
		{
			"binding": "SESSION",
			"id": "e1406f2f0b334423a197928f55fd90f8"
		}
	],
	// Workers AI (embeddings + study-guide generation) and Vectorize (sermon search index).
	"ai": { "binding": "AI" },
	"vectorize": [
		{ "binding": "SERMONS", "index_name": "kharis-sermons" }
	]
```

- [ ] **Step 2: Create the Vectorize index** (matches bge-base-en-v1.5 = 768 dims, cosine)

```bash
npx wrangler vectorize create kharis-sermons --dimensions=768 --metric=cosine
```
Expected: index created (or "already exists" — safe to ignore on re-run).

- [ ] **Step 3: Regenerate binding types**

```bash
npm run generate-types
```
Expected: `worker-configuration.d.ts` updates so `env.AI` and `env.SERMONS` are typed. (If the run errors, the build still works — the adapters use structural types and routes may cast `env.AI as never`-free via the generated types.)

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc worker-configuration.d.ts
git commit -m "chore: add Workers AI + Vectorize bindings (kharis-sermons index)"
```

---

## Task 2: migrations (transcript + study-guide cache)

**Files:** Create `migrations/0012_sermon_transcript.sql`, `migrations/0013_sermon_study_guides.sql`.

- [ ] **Step 1: `migrations/0012_sermon_transcript.sql`**

```sql
ALTER TABLE sermons ADD COLUMN transcript TEXT;
```

- [ ] **Step 2: `migrations/0013_sermon_study_guides.sql`**

```sql
CREATE TABLE IF NOT EXISTS sermon_study_guides (
  sermon_id INTEGER PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  guide_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: Apply locally + verify**

```bash
npx wrangler d1 migrations apply kharisbuilders --local
npx wrangler d1 execute kharisbuilders --local --command "SELECT name FROM pragma_table_info('sermons') WHERE name='transcript';"
npx wrangler d1 execute kharisbuilders --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='sermon_study_guides';"
```
Expected: `transcript` present; table listed.

- [ ] **Step 4: Commit** `feat: sermon transcript column + study-guide cache table`.

---

## Task 3: text + hash helpers (TDD)

**Files:** Create `src/lib/ai/text.ts`, `src/lib/ai/hash.ts`, `tests/ai/text.test.ts`, `tests/ai/hash.test.ts`.

- [ ] **Step 1: Write failing tests**

`tests/ai/text.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { composeSermonText, truncate } from '../../src/lib/ai/text';

const base = { title: 'Faith That Builds', speaker: 'Pastor A', series: 'Foundations', scripture_ref: 'Heb 11', description: 'On trusting God.', transcript: null as string | null };

describe('composeSermonText', () => {
  it('joins the metadata fields', () => {
    const t = composeSermonText(base);
    expect(t).toContain('Faith That Builds');
    expect(t).toContain('Heb 11');
    expect(t).toContain('On trusting God.');
  });
  it('includes the transcript when present', () => {
    expect(composeSermonText({ ...base, transcript: 'Today we talk about anchoring.' })).toContain('anchoring');
  });
});

describe('truncate', () => {
  it('caps length and is a no-op when short', () => {
    expect(truncate('hello', 100)).toBe('hello');
    expect(truncate('abcdef', 4).length).toBe(4);
  });
});
```

`tests/ai/hash.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { contentHash } from '../../src/lib/ai/hash';

describe('contentHash', () => {
  it('matches node sha-256 and changes with content', async () => {
    const oracle = createHash('sha256').update('hello').digest('hex');
    expect(await contentHash('hello')).toBe(oracle);
    expect(await contentHash('hello')).not.toBe(await contentHash('hello!'));
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

`src/lib/ai/text.ts`:
```ts
export interface SermonTextFields {
  title: string;
  speaker?: string | null;
  series?: string | null;
  scripture_ref?: string | null;
  description?: string | null;
  transcript?: string | null;
}

/** One text blob representing a sermon, for embedding + study-guide generation. */
export function composeSermonText(s: SermonTextFields): string {
  const parts = [
    s.title,
    s.series ? `Series: ${s.series}` : '',
    s.speaker ? `Speaker: ${s.speaker}` : '',
    s.scripture_ref ? `Scripture: ${s.scripture_ref}` : '',
    s.description ?? '',
    s.transcript ?? '',
  ];
  return parts.filter((p) => p && p.trim().length > 0).join('\n').trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}
```

`src/lib/ai/hash.ts`:
```ts
/** Hex sha-256 of `text` via WebCrypto (Workers + Node 18+). */
export async function contentHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: AI sermon text composition + content hash with tests`.

---

## Task 4: study-guide prompt + parser (TDD)

**Files:** Create `src/lib/ai/study-guide.ts`, `tests/ai/study-guide.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildStudyGuideMessages, parseStudyGuide } from '../../src/lib/ai/study-guide';

describe('buildStudyGuideMessages', () => {
  it('includes the sermon text and a JSON instruction', () => {
    const msgs = buildStudyGuideMessages({ title: 'Faith' }, 'On trusting God.');
    expect(msgs[0].role).toBe('system');
    expect(msgs.some((m) => m.content.includes('JSON'))).toBe(true);
    expect(msgs.some((m) => m.content.includes('On trusting God.'))).toBe(true);
  });
});

describe('parseStudyGuide', () => {
  it('parses clean JSON', () => {
    const g = parseStudyGuide('{"summary":"S","key_points":["a","b"],"reflection_questions":["q"],"related_scriptures":["Heb 11"]}');
    expect(g.summary).toBe('S');
    expect(g.keyPoints).toEqual(['a', 'b']);
    expect(g.reflectionQuestions).toEqual(['q']);
    expect(g.relatedScriptures).toEqual(['Heb 11']);
  });
  it('extracts JSON wrapped in prose/fences', () => {
    const g = parseStudyGuide('Here you go:\n```json\n{"summary":"S","key_points":[]}\n```\nHope that helps');
    expect(g.summary).toBe('S');
    expect(g.keyPoints).toEqual([]);
  });
  it('falls back to summary-only on unparseable output', () => {
    const g = parseStudyGuide('I could not format this.');
    expect(g.summary).toBe('I could not format this.');
    expect(g.keyPoints).toEqual([]);
    expect(g.reflectionQuestions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/ai/study-guide.ts`**

```ts
export interface StudyGuide {
  summary: string;
  keyPoints: string[];
  reflectionQuestions: string[];
  relatedScriptures: string[];
}

export interface GuideSermonMeta {
  title: string;
  speaker?: string | null;
  scripture_ref?: string | null;
}

export function buildStudyGuideMessages(meta: GuideSermonMeta, text: string): { role: string; content: string }[] {
  const system =
    'You are a helpful assistant for a Christian church. From the sermon provided, produce a concise study guide ' +
    'as STRICT JSON with exactly these keys: "summary" (2-3 sentence string), "key_points" (array of 3-5 short strings), ' +
    '"reflection_questions" (array of 3-4 strings), "related_scriptures" (array of scripture references as strings). ' +
    'Output ONLY the JSON object, no prose, no code fences.';
  const user = `Sermon: ${meta.title}${meta.scripture_ref ? ` (${meta.scripture_ref})` : ''}\n\n${text}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim()) : [];
}

/** Always returns a valid StudyGuide. Tolerates prose/fences and missing keys. */
export function parseStudyGuide(raw: string): StudyGuide {
  let obj: Record<string, unknown> | null = null;
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  obj = tryParse(raw.trim());
  if (!obj) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (!obj) {
    return { summary: raw.trim().slice(0, 1000), keyPoints: [], reflectionQuestions: [], relatedScriptures: [] };
  }
  return {
    summary: typeof obj.summary === 'string' ? obj.summary.trim() : '',
    keyPoints: asStringArray(obj.key_points),
    reflectionQuestions: asStringArray(obj.reflection_questions),
    relatedScriptures: asStringArray(obj.related_scriptures),
  };
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: study-guide prompt builder + tolerant JSON parser with tests`.

---

## Task 5: injected clients (interfaces + adapters)

**Files:** Create `src/lib/ai/clients.ts`.

- [ ] **Step 1: Implement** (structural binding types so the build never depends on global AI types)

```ts
export interface AIClient {
  embed(text: string): Promise<number[]>;
  generate(messages: { role: string; content: string }[]): Promise<string>;
}

export interface VectorStore {
  upsert(vectors: { id: string; values: number[]; metadata?: Record<string, unknown> }[]): Promise<void>;
  query(values: number[], topK: number): Promise<{ id: string; score: number }[]>;
  remove(ids: string[]): Promise<void>;
}

// Minimal structural shapes of the Cloudflare bindings (avoids depending on global types).
interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<{ data?: number[][]; response?: string }>;
}
interface VectorizeBinding {
  upsert(vectors: { id: string; values: number[]; metadata?: Record<string, unknown> }[]): Promise<unknown>;
  query(values: number[], opts: { topK: number }): Promise<{ matches: { id: string; score: number }[] }>;
  deleteByIds(ids: string[]): Promise<unknown>;
}

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const GEN_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export function workersAi(ai: AiBinding): AIClient {
  return {
    async embed(text) {
      const r = await ai.run(EMBED_MODEL, { text });
      return r.data?.[0] ?? [];
    },
    async generate(messages) {
      const r = await ai.run(GEN_MODEL, { messages, max_tokens: 1024 });
      return r.response ?? '';
    },
  };
}

export function vectorize(index: VectorizeBinding): VectorStore {
  return {
    async upsert(vectors) {
      await index.upsert(vectors);
    },
    async query(values, topK) {
      const r = await index.query(values, { topK });
      return r.matches.map((m) => ({ id: m.id, score: m.score }));
    },
    async remove(ids) {
      await index.deleteByIds(ids);
    },
  };
}
```

- [ ] **Step 2: Typecheck** via `npm run build` (no route uses it yet, so this just ensures it compiles). Expected: success.

- [ ] **Step 3: Commit** `feat: Workers AI + Vectorize client adapters behind testable interfaces`.

---

## Task 6: search + index orchestration (TDD with fakes)

**Files:** Create `src/lib/ai/search.ts`, `src/lib/ai/index-sermon.ts`, `tests/ai/search.test.ts`, `tests/ai/index-sermon.test.ts`.

- [ ] **Step 1: Write failing tests**

`tests/ai/search.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { searchSermonIds } from '../../src/lib/ai/search';

describe('searchSermonIds', () => {
  it('embeds the query and returns ordered numeric ids', async () => {
    const ai = { embed: vi.fn(async () => [0.1, 0.2]), generate: vi.fn() };
    const store = { upsert: vi.fn(), remove: vi.fn(), query: vi.fn(async () => [{ id: '7', score: 0.9 }, { id: '3', score: 0.8 }]) };
    const ids = await searchSermonIds({ ai, store }, 'anxiety', 5);
    expect(ai.embed).toHaveBeenCalledWith('anxiety');
    expect(store.query).toHaveBeenCalledWith([0.1, 0.2], 5);
    expect(ids).toEqual([7, 3]);
  });
});
```

`tests/ai/index-sermon.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { indexSermon, removeSermon } from '../../src/lib/ai/index-sermon';

describe('indexSermon', () => {
  it('embeds the composed text and upserts a vector with metadata', async () => {
    const ai = { embed: vi.fn(async () => [1, 2, 3]), generate: vi.fn() };
    const store = { upsert: vi.fn(async () => {}), remove: vi.fn(), query: vi.fn() };
    await indexSermon({ ai, store }, { id: 9, slug: 'faith', title: 'Faith', description: 'x', published: 1 });
    expect(ai.embed).toHaveBeenCalled();
    expect(store.upsert).toHaveBeenCalledWith([
      expect.objectContaining({ id: '9', values: [1, 2, 3], metadata: expect.objectContaining({ slug: 'faith', published: true }) }),
    ]);
  });
});

describe('removeSermon', () => {
  it('removes by string id', async () => {
    const store = { upsert: vi.fn(), remove: vi.fn(async () => {}), query: vi.fn() };
    await removeSermon(store, 9);
    expect(store.remove).toHaveBeenCalledWith(['9']);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

`src/lib/ai/search.ts`:
```ts
import type { AIClient, VectorStore } from './clients';

export async function searchSermonIds(
  deps: { ai: AIClient; store: VectorStore },
  query: string,
  topK: number,
): Promise<number[]> {
  const vec = await deps.ai.embed(query);
  const matches = await deps.store.query(vec, topK);
  return matches.map((m) => Number(m.id)).filter((n) => Number.isFinite(n));
}
```

`src/lib/ai/index-sermon.ts`:
```ts
import type { AIClient, VectorStore } from './clients';
import { composeSermonText, truncate, type SermonTextFields } from './text';

export interface IndexableSermon extends SermonTextFields {
  id: number;
  slug: string;
  published?: number | boolean;
}

export async function indexSermon(deps: { ai: AIClient; store: VectorStore }, sermon: IndexableSermon): Promise<void> {
  const text = truncate(composeSermonText(sermon), 2000);
  const values = await deps.ai.embed(text);
  await deps.store.upsert([
    { id: String(sermon.id), values, metadata: { slug: sermon.slug, title: sermon.title, published: !!sermon.published } },
  ]);
}

export async function removeSermon(store: VectorStore, id: number): Promise<void> {
  await store.remove([String(id)]);
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: searchSermonIds + indexSermon orchestration with tests`.

---

## Task 7: sermons DB additions + study-guide cache DB (TDD)

**Files:** Modify `src/lib/db/sermons.ts`; create `src/lib/db/study-guides.ts`, `tests/db/sermons-ai.test.ts`.

- [ ] **Step 1: Modify `src/lib/db/sermons.ts`**

Add `transcript` to the `Sermon` interface (after `description`):
```ts
  transcript: string | null;
```
Update `COLS` to include it:
```ts
const COLS =
  'id, title, slug, speaker, series, scripture_ref, video_url, video_provider, thumbnail_key, description, transcript, sermon_date';
```
In `createSermon`, add `transcript` to the column list + VALUES + bind (after `description`):
```ts
// INSERT columns: ... scripture_ref, video_url, video_provider, description, transcript, sermon_date, published, updated_by
// add one more ? in VALUES, and in .bind add `input.transcript || null,` right after `input.description || null,`
```
Same for `updateSermon` (`description=?, transcript=?, ...`) with `input.transcript || null` in the bind.
Append three helpers:
```ts
export async function getPublishedSermonsByIds(db: D1Database, ids: number[]): Promise<Sermon[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM sermons WHERE published = 1 AND id IN (${placeholders})`)
    .bind(...ids)
    .all<Sermon>();
  // preserve the incoming (ranked) order
  const byId = new Map(results.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is Sermon => s != null);
}

export async function searchSermonsKeyword(db: D1Database, q: string, limit = 24): Promise<Sermon[]> {
  const like = `%${q}%`;
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM sermons WHERE published = 1 AND (title LIKE ? OR description LIKE ? OR scripture_ref LIKE ? OR series LIKE ?)
       ORDER BY sermon_date DESC, id DESC LIMIT ?`,
    )
    .bind(like, like, like, like, limit)
    .all<Sermon>();
  return results;
}

export async function listAllSermonIds(db: D1Database): Promise<number[]> {
  const { results } = await db.prepare('SELECT id FROM sermons').all<{ id: number }>();
  return results.map((r) => r.id);
}
```
Also add `transcript` to the `SermonInputSchema`? — handled in Task 11 (form). For now add to schema in Task 11; the create/update bind uses `input.transcript`, so add `transcript` to `SermonInputSchema` now to avoid a type error:
in `src/lib/db/schemas.ts`, inside `SermonInputSchema` (after `description`):
```ts
  transcript: z.string().trim().max(100000).optional().or(z.literal('')),
```

- [ ] **Step 2: Implement `src/lib/db/study-guides.ts`**

```ts
export interface CachedGuide {
  content_hash: string;
  guide_json: string;
}

export async function getCachedGuide(db: D1Database, sermonId: number): Promise<CachedGuide | null> {
  const row = await db
    .prepare('SELECT content_hash, guide_json FROM sermon_study_guides WHERE sermon_id = ?')
    .bind(sermonId)
    .first<CachedGuide>();
  return row ?? null;
}

export async function upsertGuide(db: D1Database, sermonId: number, hash: string, json: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sermon_study_guides (sermon_id, content_hash, guide_json, generated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(sermon_id) DO UPDATE SET content_hash=excluded.content_hash, guide_json=excluded.guide_json, generated_at=datetime('now')`,
    )
    .bind(sermonId, hash, json)
    .run();
}

export async function deleteGuide(db: D1Database, sermonId: number): Promise<void> {
  await db.prepare('DELETE FROM sermon_study_guides WHERE sermon_id = ?').bind(sermonId).run();
}
```

- [ ] **Step 3: Write + run the test** (`tests/db/sermons-ai.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createSermon, getPublishedSermonsByIds, searchSermonsKeyword, setSermonPublished } from '../../src/lib/db/sermons';
import { getCachedGuide, upsertGuide, deleteGuide } from '../../src/lib/db/study-guides';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

const s = (over: Record<string, unknown> = {}) => ({
  title: 'Faith', slug: '', speaker: '', series: '', scripture_ref: 'Heb 11', video_url: 'https://youtu.be/x',
  video_provider: 'youtube' as const, description: 'trusting God', transcript: '', sermon_date: '2024-01-01', published: true, ...over,
});

describe('sermon AI db helpers', () => {
  it('getPublishedSermonsByIds returns published rows in the given order', async () => {
    const a = await createSermon(ctx.db, s({ title: 'Anxiety', slug: 'anxiety' }), 'a@x');
    const b = await createSermon(ctx.db, s({ title: 'Marriage', slug: 'marriage' }), 'a@x');
    const draft = await createSermon(ctx.db, s({ title: 'Draft', slug: 'draft', published: false }), 'a@x');
    const rows = await getPublishedSermonsByIds(ctx.db, [b, a, draft]);
    expect(rows.map((r) => r.id)).toEqual([b, a]); // draft dropped, order preserved
  });
  it('searchSermonsKeyword matches title/description', async () => {
    const rows = await searchSermonsKeyword(ctx.db, 'Anxiety');
    expect(rows.some((r) => r.title === 'Anxiety')).toBe(true);
  });
  it('study-guide cache upsert/get/delete', async () => {
    const id = await createSermon(ctx.db, s({ title: 'Cache', slug: 'cache' }), 'a@x');
    await upsertGuide(ctx.db, id, 'h1', '{"summary":"x"}');
    expect((await getCachedGuide(ctx.db, id))?.content_hash).toBe('h1');
    await upsertGuide(ctx.db, id, 'h2', '{"summary":"y"}'); // replace
    expect((await getCachedGuide(ctx.db, id))?.content_hash).toBe('h2');
    await deleteGuide(ctx.db, id);
    expect(await getCachedGuide(ctx.db, id)).toBeNull();
  });
});
```
Run → pass.

- [ ] **Step 4: Commit** `feat: sermons transcript + search/ids helpers + study-guide cache DB with tests`.

---

## Task 8: guide service (cache-or-generate, TDD)

**Files:** Create `src/lib/ai/guide-service.ts`, `tests/ai/guide-service.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createSermon, getSermonById } from '../../src/lib/db/sermons';
import { getOrGenerateGuide } from '../../src/lib/ai/guide-service';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

const sermon = (over = {}) => ({ title: 'Faith', slug: 'faith', speaker: '', series: '', scripture_ref: 'Heb 11', video_url: 'https://youtu.be/x', video_provider: 'youtube' as const, description: 'On trusting God deeply.', transcript: '', sermon_date: '2024-01-01', published: true, ...over });

describe('getOrGenerateGuide', () => {
  it('generates + caches on miss, then serves cache without calling AI', async () => {
    const id = await createSermon(ctx.db, sermon(), 'a@x');
    const full = await getSermonById(ctx.db, id);
    const ai = { embed: vi.fn(), generate: vi.fn(async () => '{"summary":"Trust God","key_points":["a"],"reflection_questions":["q"],"related_scriptures":["Heb 11"]}') };

    const g1 = await getOrGenerateGuide(ctx.db, ai, full!);
    expect(g1?.summary).toBe('Trust God');
    expect(ai.generate).toHaveBeenCalledTimes(1);

    const g2 = await getOrGenerateGuide(ctx.db, ai, full!);
    expect(g2?.summary).toBe('Trust God');
    expect(ai.generate).toHaveBeenCalledTimes(1); // served from cache
  });

  it('returns null when there is no real content to summarise', async () => {
    const id = await createSermon(ctx.db, sermon({ slug: 'bare', description: '', transcript: '' }), 'a@x');
    const full = await getSermonById(ctx.db, id);
    const ai = { embed: vi.fn(), generate: vi.fn() };
    const g = await getOrGenerateGuide(ctx.db, ai, full!);
    expect(g).toBeNull();
    expect(ai.generate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/ai/guide-service.ts`**

```ts
import type { AIClient } from './clients';
import { composeSermonText, truncate, type SermonTextFields } from './text';
import { contentHash } from './hash';
import { buildStudyGuideMessages, parseStudyGuide, type StudyGuide } from './study-guide';
import { getCachedGuide, upsertGuide } from '../db/study-guides';

export interface GuideSermon extends SermonTextFields {
  id: number;
}

/** Enough material to summarise: a non-trivial description or transcript. */
function hasContent(s: GuideSermon): boolean {
  return (s.description?.trim().length ?? 0) >= 40 || (s.transcript?.trim().length ?? 0) >= 40;
}

/** Cache-or-generate the study guide for a sermon. Returns null when there's too little content. */
export async function getOrGenerateGuide(db: D1Database, ai: AIClient, sermon: GuideSermon): Promise<StudyGuide | null> {
  if (!hasContent(sermon)) return null;
  const text = truncate(composeSermonText(sermon), 6000);
  const hash = await contentHash(text);

  const cached = await getCachedGuide(db, sermon.id);
  if (cached && cached.content_hash === hash) {
    try {
      return JSON.parse(cached.guide_json) as StudyGuide;
    } catch {
      /* fall through to regenerate */
    }
  }

  const raw = await ai.generate(buildStudyGuideMessages(sermon, text));
  const guide = parseStudyGuide(raw);
  await upsertGuide(db, sermon.id, hash, JSON.stringify(guide));
  return guide;
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: study-guide cache-or-generate service with tests`.

---

## Task 9: API routes + admin index-on-save

**Files:** Create `src/pages/api/ai/study-guide.ts`, `src/pages/api/admin/ai/reindex.ts`; modify `src/pages/api/admin/sermons.ts`.

- [ ] **Step 1: `src/pages/api/ai/study-guide.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { getSermonBySlug } from '../../../lib/db/sermons';
import { workersAi } from '../../../lib/ai/clients';
import { getOrGenerateGuide } from '../../../lib/ai/guide-service';

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('sermon');
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
  if (!slug) return json({ available: false });
  const sermon = await getSermonBySlug(env.DB, slug).catch(() => null);
  if (!sermon) return json({ available: false });
  const guide = await getOrGenerateGuide(env.DB, workersAi(env.AI), sermon).catch(() => null);
  return json(guide ? { available: true, guide } : { available: false });
};
```

- [ ] **Step 2: `src/pages/api/admin/ai/reindex.ts`** (gated backfill)

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../../lib/runtime';
import { requireAdmin } from '../../../../lib/admin-auth';
import { getSermonById, listAllSermonIds } from '../../../../lib/db/sermons';
import { workersAi, vectorize } from '../../../../lib/ai/clients';
import { indexSermon } from '../../../../lib/ai/index-sermon';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const ids = await listAllSermonIds(env.DB);
  const deps = { ai: workersAi(env.AI), store: vectorize(env.SERMONS) };
  let indexed = 0;
  for (const id of ids) {
    const sermon = await getSermonById(env.DB, id);
    if (!sermon) continue;
    try {
      await indexSermon(deps, sermon);
      indexed++;
    } catch {
      /* skip a failing sermon, continue */
    }
  }
  return new Response(JSON.stringify({ indexed, total: ids.length }), { headers: { 'content-type': 'application/json' } });
};
```

- [ ] **Step 3: Wire best-effort index-on-save into `src/pages/api/admin/sermons.ts`**

Add imports:
```ts
import { getSermonById } from '../../../lib/db/sermons';
import { workersAi, vectorize } from '../../../lib/ai/clients';
import { indexSermon, removeSermon } from '../../../lib/ai/index-sermon';
import { deleteGuide } from '../../../lib/db/study-guides';
```
> Note: `getSermonById` may already be imported via the sermons module; if so, add only the missing names.

In the create/update branch (after the existing image-upload block, still inside the `else`):
```ts
      // Best-effort: re-embed for search + invalidate the cached study guide. Never fail the save.
      try {
        const full = await getSermonById(env.DB, targetId);
        if (full) {
          await indexSermon({ ai: workersAi(env.AI), store: vectorize(env.SERMONS) }, full);
          await deleteGuide(env.DB, targetId);
        }
      } catch {
        /* indexing is best-effort */
      }
```
In the `delete` branch (after `await deleteSermon(env.DB, id);`):
```ts
      try {
        await removeSermon(vectorize(env.SERMONS), id);
      } catch {
        /* best-effort */
      }
```

- [ ] **Step 4: Build** (`npm run build`) → succeeds. If TS complains that `env.AI`/`env.SERMONS` are untyped, ensure Task 1 Step 3 ran; as a fallback, the adapters accept structural types so `workersAi(env.AI)` compiles once the binding is declared.

- [ ] **Step 5: Commit** `feat: study-guide + reindex endpoints + best-effort index-on-save`.

---

## Task 10: sermons search UI + study-guide section + transcript field

**Files:** Modify `src/pages/sermons/index.astro`, `src/pages/sermons/[slug].astro`, `src/components/admin/SermonForm.astro`.

- [ ] **Step 1: Search on `src/pages/sermons/index.astro`** — replace the frontmatter sermon-loading with search-aware loading

```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import PageHero from '../../components/PageHero.astro';
import SermonCard from '../../components/SermonCard.astro';
import { env } from '../../lib/runtime';
import { mediaUrl } from '../../lib/media';
import { listPublishedSermons, getPublishedSermonsByIds, searchSermonsKeyword, type Sermon } from '../../lib/db/sermons';
import { workersAi, vectorize } from '../../lib/ai/clients';
import { searchSermonIds } from '../../lib/ai/search';

const q = (Astro.url.searchParams.get('q') ?? '').trim();
let sermons: Sermon[] = [];
try {
  if (q) {
    try {
      const ids = await searchSermonIds({ ai: workersAi(env.AI), store: vectorize(env.SERMONS) }, q, 12);
      sermons = await getPublishedSermonsByIds(env.DB, ids);
      if (sermons.length === 0) sermons = await searchSermonsKeyword(env.DB, q);
    } catch {
      sermons = await searchSermonsKeyword(env.DB, q);
    }
  } else {
    sermons = await listPublishedSermons(env.DB);
  }
} catch {
  sermons = [];
}
const imgs = ['/images/home-3.jpg', '/images/ministries-2.jpg', '/images/home-5.jpg'];
---
<PublicLayout title="Sermons | Kharisbuilders" description="Watch and search the latest messages from Kharisbuilders.">
  <PageHero image="/images/home-3.jpg" height="h-[360px] md:h-[460px]">
    <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block hero-shadow">Messages</span>
    <h1 class="font-display text-display-mobile md:text-display-lg text-white hero-shadow">Sermons</h1>
    <p class="font-body text-body-lg text-white/85 max-w-2xl mx-auto mt-4 hero-shadow">Ancient truth, modern application — search by topic or browse recent messages.</p>
  </PageHero>
  <section class="py-16 md:py-24 px-margin-mobile md:px-margin-desktop max-w-[var(--container-max)] mx-auto">
    <form method="get" class="flex gap-3 max-w-xl mx-auto mb-12">
      <input type="search" name="q" value={q} placeholder="Search sermons by topic, e.g. 'anxiety' or 'forgiveness'"
        class="flex-1 border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
      <button type="submit" class="bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-6 hover:bg-secondary transition-all">Search</button>
    </form>
    {q && (
      <p class="text-center font-body text-body-md text-stone-gray mb-10">
        {sermons.length} result{sermons.length === 1 ? '' : 's'} for <span class="text-primary">“{q}”</span> · <a href="/sermons" class="text-heritage-gold border-b border-heritage-gold/40">clear</a>
      </p>
    )}
    {
      sermons.length === 0 ? (
        <p class="text-center text-stone-gray font-body">{q ? 'No sermons matched — try a different word.' : 'No sermons published yet — check back soon.'}</p>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10" data-reveal>
          {sermons.map((s, i) => <SermonCard sermon={s} image={mediaUrl(s.thumbnail_key) ?? imgs[i % imgs.length]} />)}
        </div>
      )
    }
  </section>
</PublicLayout>
```

- [ ] **Step 2: Study-guide section on `src/pages/sermons/[slug].astro`** — add before the closing `</PublicLayout>` (after the "All sermons" link block)

```astro
  <section class="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop pb-24">
    <div id="study-guide" data-slug={sermon.slug} class="hidden">
      <div class="flex items-center gap-4 mb-8">
        <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold">Study Guide</span>
        <span class="kente-rule flex-1"></span>
      </div>
      <div id="sg-body" class="space-y-8"></div>
      <p class="font-body text-body-sm text-stone-gray mt-6">Generated by AI from this message — a starting point for reflection, not a substitute for it.</p>
    </div>
    <div id="sg-skeleton" class="animate-pulse space-y-4 mt-4">
      <div class="h-4 bg-surface-container-high rounded w-1/3"></div>
      <div class="h-3 bg-surface-container-high rounded w-full"></div>
      <div class="h-3 bg-surface-container-high rounded w-5/6"></div>
    </div>
  </section>
  <script>
    (async () => {
      const root = document.getElementById('study-guide');
      const skel = document.getElementById('sg-skeleton');
      const body = document.getElementById('sg-body');
      if (!root || !body) return;
      const slug = root.getAttribute('data-slug');
      try {
        const res = await fetch(`/api/ai/study-guide?sermon=${encodeURIComponent(slug || '')}`);
        const data = await res.json();
        if (!data.available) {
          skel?.remove();
          return;
        }
        const g = data.guide;
        const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const list = (title, items) =>
          items && items.length
            ? `<div><h3 class="font-display text-headline-md text-primary mb-3">${title}</h3><ul class="list-disc pl-5 space-y-2 font-body text-body-md text-stone-gray">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`
            : '';
        body.innerHTML =
          (g.summary ? `<p class="font-body text-body-lg text-stone-gray leading-relaxed">${esc(g.summary)}</p>` : '') +
          list('Key points', g.keyPoints) +
          list('Reflection questions', g.reflectionQuestions) +
          list('Related scriptures', g.relatedScriptures);
        skel?.remove();
        root.classList.remove('hidden');
      } catch {
        skel?.remove();
      }
    })();
  </script>
```

- [ ] **Step 3: Transcript field on `src/components/admin/SermonForm.astro`** — add after the Description field

```astro
  <div class="flex flex-col gap-1">
    <label for="f-transcript" class="text-xs uppercase tracking-wider text-on-surface-variant">Transcript (optional — improves AI search + study guide)</label>
    <textarea id="f-transcript" name="transcript" rows="6" class="border border-champagne bg-surface px-4 py-3 font-body text-sm text-primary" set:text={sermon?.transcript ?? ''} />
    <p class="text-xs text-on-surface-variant">Paste the sermon transcript or YouTube auto-captions.</p>
  </div>
```
> `set:text` (not a value attribute) avoids whitespace injection in the textarea (existing gotcha). Requires `transcript` on `SermonFull` — it's in `COLS`, so `getSermonById` already returns it.

- [ ] **Step 4: Build** → succeeds.

- [ ] **Step 5: Commit** `feat: sermon semantic search UI + AI study-guide section + admin transcript field`.

---

## Task 11: full gate + live verification

- [ ] **Step 1: Full unit suite** (`npx vitest run`) — prior 126 + new (~16) pass.

- [ ] **Step 2: Build** (`npm run build`).

- [ ] **Step 3: Apply migrations to remote + deploy**

```bash
npx wrangler d1 migrations apply kharisbuilders --remote
npx wrangler deploy
```

- [ ] **Step 4: Backfill the index (one-time) on the live worker.** From a browser logged into Cloudflare Access (so the admin POST carries identity), or via an authenticated request, call:
```
POST https://kharisbuilders.missdiasporagh.workers.dev/api/admin/ai/reindex
```
Expected JSON: `{ "indexed": N, "total": N }`. (In dev this is gated by `DEV_ADMIN_EMAIL`; in prod by Cloudflare Access.)

- [ ] **Step 5: Verify live**
```bash
# semantic search returns ranked sermons
curl -s "https://kharisbuilders.missdiasporagh.workers.dev/sermons?q=faith" | grep -c 'class="group'   # >0 cards
# study guide endpoint returns a guide for a known sermon slug
curl -s "https://kharisbuilders.missdiasporagh.workers.dev/api/ai/study-guide?sermon=grace-that-builds" | head -c 300
```
Expected: search shows ranked results; the study-guide endpoint returns `{"available":true,"guide":{...}}`. Open a sermon page in a browser and confirm the Study Guide renders under the skeleton; reload → instant (cached). Paste a transcript into a sermon via admin → its guide regenerates with sharper content; re-run reindex if you want its search vector refreshed.

- [ ] **Step 6: Clean tree** (`git status --short`).

---

## Phase C1 Done — Definition of Done
- Workers AI + Vectorize bindings configured; `kharis-sermons` index created.
- Sermons embed on save + via a one-time reindex; `/sermons?q=` returns semantically ranked results with a keyword fallback that never 500s.
- Each sermon page shows an AI study guide (summary / key points / reflection questions / related scriptures), generated once and cached, regenerating only when the sermon changes.
- Staff can paste a transcript to sharpen both search and the guide.
- `npx vitest run` + `npm run build` pass; live search + study guide verified on the deployed worker.

**Next:** Phase C2 — conversational "Ask Kharis" RAG chat over sermon transcripts (dedicated page), once transcripts are being added.

---

## Open Questions (resolved defaults)
- Models: `bge-base-en-v1.5` (embed) + `llama-3.1-8b-instruct` (generate); swap in `clients.ts` if needed.
- Embed input ≤2000 chars, guide input ≤6000; topK 12; guide requires ≥40 chars of description/transcript.
- Index-on-save is best-effort; the gated reindex endpoint is the source of truth for backfills/repairs.
