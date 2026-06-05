# C2: "Ask the Pastor" RAG Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/sermons/ask` page where a visitor asks a question and gets one grounded answer drawn from the church's published sermons, with citations linking back to the source sermons.

**Architecture:** Reuse C1's retrieval + generation. A pure, unit-tested core (`src/lib/ai/ask.ts`: `selectContexts`, `buildAskMessages`, `answerQuestion`) with all bindings injected; a thin Turnstile-guarded `POST /api/ai/ask` endpoint wiring real bindings; and a server-rendered `/sermons/ask` page that calls the endpoint via client `fetch` with a loading state. Single-turn, non-streaming. No-match questions return a warm fallback without invoking the LLM.

**Tech Stack:** Astro 6 SSR, Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct`) + Vectorize, Cloudflare Turnstile, Vitest. Spec: `docs/superpowers/specs/2026-06-05-C2-ask-the-pastor-rag-chat-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

> **Note:** Workers AI + Vectorize bindings do NOT resolve in `astro dev`/`astro build` — only on the deployed Worker. So the pure core is unit-tested offline; the live path is verified post-deploy (after the admin "Reindex AI search").

---

## File Structure

```
src/lib/ai/ask.ts              # CREATE — pure: selectContexts, buildAskMessages, FALLBACK_ANSWER, answerQuestion (Tasks 1-3)
tests/ai/ask.test.ts           # CREATE — unit tests for the pure core (Tasks 1-3)
src/pages/api/ai/ask.ts        # CREATE — POST endpoint: feature gate + Turnstile + answerQuestion (Task 4)
src/pages/sermons/ask.astro    # CREATE — the Ask page (form + client fetch + answer/citations) (Task 5)
src/pages/sermons/index.astro  # MODIFY — add "Ask the Pastor" CTA below the search box (Task 5)
```

Reused as-is: `src/lib/ai/clients.ts` (`AIClient`, `VectorStore`, `workersAi`, `vectorize`), `src/lib/ai/search.ts` (`searchSermonIds`), `src/lib/ai/text.ts` (`composeSermonText`, `truncate`), `src/lib/db/sermons.ts` (`Sermon`, `getPublishedSermonsByIds`), `src/lib/turnstile.ts` (`verifyTurnstile`), `src/lib/db/settings.ts` (`getAllSettings`).

---

## Task 1: Pure core — `selectContexts`

**Files:** Create `src/lib/ai/ask.ts`, `tests/ai/ask.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/ai/ask.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { Sermon } from '../../src/lib/db/sermons';
import { selectContexts } from '../../src/lib/ai/ask';

function mkSermon(over: Partial<Sermon>): Sermon {
  return {
    id: 1,
    title: 'Faith',
    slug: 'faith',
    speaker: 'Pastor A',
    series: null,
    scripture_ref: 'Hebrews 11',
    video_url: '',
    video_provider: 'youtube',
    thumbnail_key: null,
    description: 'A sermon about faith.',
    transcript: 'Faith is being sure of what we hope for.',
    sermon_date: '2026-01-01',
    ...over,
  } as Sermon;
}

describe('selectContexts', () => {
  it('numbers contexts 1..n and caps to maxSermons', () => {
    const sermons = [1, 2, 3, 4, 5].map((id) => mkSermon({ id, slug: `s${id}`, title: `S${id}` }));
    const ctx = selectContexts(sermons, { maxSermons: 3 });
    expect(ctx.length).toBe(3);
    expect(ctx.map((c) => c.n)).toEqual([1, 2, 3]);
    expect(ctx[0].slug).toBe('s1');
    expect(ctx[0].title).toBe('S1');
  });
  it('truncates each sermon text to perSermonChars', () => {
    const long = 'x'.repeat(5000);
    const ctx = selectContexts([mkSermon({ transcript: long })], { perSermonChars: 100 });
    expect(ctx[0].text.length).toBeLessThanOrEqual(100);
  });
  it('carries speaker and scripture for citations', () => {
    const ctx = selectContexts([mkSermon({ speaker: 'Pastor B', scripture_ref: 'John 3' })]);
    expect(ctx[0].speaker).toBe('Pastor B');
    expect(ctx[0].scripture_ref).toBe('John 3');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/ai/ask.test.ts`
Expected: FAIL (cannot import `selectContexts`).

- [ ] **Step 3: Create `src/lib/ai/ask.ts`** with the types + `selectContexts`

```ts
import type { Sermon } from '../db/sermons';
import { composeSermonText, truncate } from './text';

export interface Context {
  n: number;
  slug: string;
  title: string;
  speaker: string | null;
  scripture_ref: string | null;
  text: string;
}

export interface Citation {
  slug: string;
  title: string;
  speaker: string | null;
  scripture_ref: string | null;
}

export interface SelectOpts {
  maxSermons?: number;
  perSermonChars?: number;
}

/** Turn retrieved sermons into numbered, truncated context blocks for the prompt. */
export function selectContexts(sermons: Sermon[], opts: SelectOpts = {}): Context[] {
  const maxSermons = opts.maxSermons ?? 4;
  const perSermonChars = opts.perSermonChars ?? 1200;
  return sermons.slice(0, maxSermons).map((s, i) => ({
    n: i + 1,
    slug: s.slug,
    title: s.title,
    speaker: s.speaker,
    scripture_ref: s.scripture_ref,
    text: truncate(composeSermonText(s), perSermonChars),
  }));
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/ai/ask.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/ask.ts tests/ai/ask.test.ts
git commit -m "feat: ask core — selectContexts (numbered, truncated sermon contexts)"
```

---

## Task 2: `buildAskMessages` + `FALLBACK_ANSWER`

**Files:** Modify `src/lib/ai/ask.ts`, `tests/ai/ask.test.ts`.

- [ ] **Step 1: Add the failing test** (append to `tests/ai/ask.test.ts`)

```ts
import { buildAskMessages, FALLBACK_ANSWER } from '../../src/lib/ai/ask';

describe('buildAskMessages', () => {
  const contexts = selectContexts([
    mkSermon({ id: 1, slug: 'a', title: 'Anxiety', speaker: 'Pastor A', scripture_ref: 'Phil 4' }),
  ]);
  const msgs = buildAskMessages('How do I deal with worry?', contexts);

  it('has a system message that constrains answers to the excerpts', () => {
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toMatch(/only/i);
    expect(msgs[0].content).toMatch(/excerpt|sermon/i);
  });
  it('puts the question and a numbered block in the user message', () => {
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toContain('How do I deal with worry?');
    expect(msgs[1].content).toContain('[1]');
    expect(msgs[1].content).toContain('Anxiety');
  });
});

describe('FALLBACK_ANSWER', () => {
  it('is a non-empty, non-doctrinal deflection', () => {
    expect(typeof FALLBACK_ANSWER).toBe('string');
    expect(FALLBACK_ANSWER.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/ai/ask.test.ts`
Expected: FAIL (`buildAskMessages` / `FALLBACK_ANSWER` not exported).

- [ ] **Step 3: Add `buildAskMessages` + `FALLBACK_ANSWER`** to `src/lib/ai/ask.ts` (append)

```ts
export const FALLBACK_ANSWER =
  "I couldn't find a sermon in our library that speaks directly to that yet. Try rephrasing your question, " +
  'browse the sermons, or reach out to the church — we would love to help you personally.';

/** Build the grounded chat messages. The model must answer ONLY from the numbered excerpts. */
export function buildAskMessages(question: string, contexts: Context[]): { role: string; content: string }[] {
  const system =
    'You are a warm, pastoral assistant for a Christian church. Answer the visitor’s question ONLY using the ' +
    'numbered sermon excerpts provided below. Speak kindly, clearly, and briefly. Cite the sermons you draw from ' +
    'inline using their numbers, like [1] or [2]. If the excerpts do not address the question, say so honestly and ' +
    'gently suggest they contact the church — do NOT use outside knowledge or invent teaching.';
  const blocks = contexts
    .map(
      (c) =>
        `[${c.n}] "${c.title}"${c.speaker ? ` — ${c.speaker}` : ''}${c.scripture_ref ? ` (${c.scripture_ref})` : ''}\n${c.text}`,
    )
    .join('\n\n');
  const user = `Question: ${question}\n\nSermon excerpts:\n${blocks}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/ai/ask.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/ask.ts tests/ai/ask.test.ts
git commit -m "feat: ask core — buildAskMessages (grounded prompt) + FALLBACK_ANSWER"
```

---

## Task 3: `answerQuestion` orchestrator

**Files:** Modify `src/lib/ai/ask.ts`, `tests/ai/ask.test.ts`.

- [ ] **Step 1: Add the failing test** (append to `tests/ai/ask.test.ts`)

```ts
import { vi } from 'vitest';
import { answerQuestion } from '../../src/lib/ai/ask';
import type { AIClient, VectorStore } from '../../src/lib/ai/clients';

function mkDeps(matches: { id: string; score: number }[], sermons: Sermon[], generated = 'Answer [1].') {
  const ai: AIClient = {
    embed: vi.fn(async () => [0.1, 0.2, 0.3]),
    generate: vi.fn(async () => generated),
  };
  const store: VectorStore = {
    query: vi.fn(async () => matches),
    upsert: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  const fetchSermons = vi.fn(async (ids: number[]) => sermons.filter((s) => ids.includes(s.id)));
  return { ai, store, fetchSermons };
}

describe('answerQuestion', () => {
  it('returns the generated answer + citations for retrieved sermons', async () => {
    const sermons = [mkSermon({ id: 1, slug: 'a', title: 'A' }), mkSermon({ id: 2, slug: 'b', title: 'B' })];
    const deps = mkDeps([{ id: '1', score: 0.9 }, { id: '2', score: 0.8 }], sermons, 'Here is the answer [1].');
    const res = await answerQuestion(deps, 'a question');
    expect(res.answer).toBe('Here is the answer [1].');
    expect(res.citations.map((c) => c.slug)).toEqual(['a', 'b']);
    expect(deps.ai.generate).toHaveBeenCalledTimes(1);
  });

  it('returns the fallback WITHOUT calling generate when nothing is retrieved', async () => {
    const deps = mkDeps([], []); // store returns no matches
    const res = await answerQuestion(deps, 'obscure question');
    expect(res.answer).toBe(FALLBACK_ANSWER);
    expect(res.citations).toEqual([]);
    expect(deps.ai.generate).not.toHaveBeenCalled();
  });

  it('returns the fallback (no generate) when ids resolve to no published sermons', async () => {
    const deps = mkDeps([{ id: '9', score: 0.5 }], []); // match id 9, but fetch finds none
    const res = await answerQuestion(deps, 'q');
    expect(res.answer).toBe(FALLBACK_ANSWER);
    expect(deps.ai.generate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/ai/ask.test.ts`
Expected: FAIL (`answerQuestion` not exported).

- [ ] **Step 3: Add `answerQuestion`** to `src/lib/ai/ask.ts` (append; add the two imports at the top of the file)

At the top of `src/lib/ai/ask.ts`, add:
```ts
import type { AIClient, VectorStore } from './clients';
import { searchSermonIds } from './search';
```

Append:
```ts
export interface AnswerDeps {
  ai: AIClient;
  store: VectorStore;
  fetchSermons: (ids: number[]) => Promise<Sermon[]>;
}

export interface AnswerResult {
  answer: string;
  citations: Citation[];
}

export interface AnswerOpts {
  topK?: number;
  maxSermons?: number;
  perSermonChars?: number;
}

/** Retrieve relevant sermons and answer the question grounded in them. No match => fallback, no LLM call. */
export async function answerQuestion(deps: AnswerDeps, question: string, opts: AnswerOpts = {}): Promise<AnswerResult> {
  const topK = opts.topK ?? 4;
  const ids = await searchSermonIds({ ai: deps.ai, store: deps.store }, question, topK);
  const sermons = ids.length ? await deps.fetchSermons(ids) : [];
  if (sermons.length === 0) return { answer: FALLBACK_ANSWER, citations: [] };
  const contexts = selectContexts(sermons, { maxSermons: opts.maxSermons, perSermonChars: opts.perSermonChars });
  const generated = (await deps.ai.generate(buildAskMessages(question, contexts))).trim();
  const citations: Citation[] = contexts.map((c) => ({
    slug: c.slug,
    title: c.title,
    speaker: c.speaker,
    scripture_ref: c.scripture_ref,
  }));
  return { answer: generated || FALLBACK_ANSWER, citations };
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/ai/ask.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/ask.ts tests/ai/ask.test.ts
git commit -m "feat: ask core — answerQuestion (RAG orchestrator, no-match short-circuit)"
```

---

## Task 4: `POST /api/ai/ask` endpoint

**Files:** Create `src/pages/api/ai/ask.ts`.

> Binding-dependent (env.AI/SERMONS/DB), so no unit test — its logic is covered by Task 3's `answerQuestion` tests; correctness of wiring is checked by `astro build` (Task 6) and verified live post-deploy.

- [ ] **Step 1: Create `src/pages/api/ai/ask.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { feature } from '../../../config/church';
import { verifyTurnstile } from '../../../lib/turnstile';
import { workersAi, vectorize } from '../../../lib/ai/clients';
import { getPublishedSermonsByIds } from '../../../lib/db/sermons';
import { answerQuestion } from '../../../lib/ai/ask';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  if (!feature('ai')) return json({ error: 'Not found' }, 404);

  let data: { question?: unknown; 'cf-turnstile-response'?: unknown };
  try {
    data = (await request.json()) as typeof data;
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const question = typeof data.question === 'string' ? data.question.trim() : '';
  if (!question || question.length > 500) {
    return json({ error: 'Please enter a question (up to 500 characters).' }, 400);
  }

  const token = typeof data['cf-turnstile-response'] === 'string' ? data['cf-turnstile-response'] : '';
  const ip = request.headers.get('CF-Connecting-IP') ?? undefined;
  const human = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, ip);
  if (!human) return json({ error: 'Could not verify you are human. Please try again.' }, 403);

  try {
    const result = await answerQuestion(
      {
        ai: workersAi(env.AI),
        store: vectorize(env.SERMONS),
        fetchSermons: (ids) => getPublishedSermonsByIds(env.DB, ids),
      },
      question,
    );
    return json(result);
  } catch {
    return json({ answer: 'Sorry — I had trouble answering just now. Please try again in a moment.', citations: [] });
  }
};
```

- [ ] **Step 2: Type-check via build**

Run: `npx astro build`
Expected: `Complete!` (no missing-import/type error). (The endpoint compiles; AI/Vectorize only run live.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/ai/ask.ts
git commit -m "feat: POST /api/ai/ask — feature-gated, Turnstile-guarded RAG endpoint"
```

---

## Task 5: `/sermons/ask` page + CTA on `/sermons`

**Files:** Create `src/pages/sermons/ask.astro`; Modify `src/pages/sermons/index.astro`.

- [ ] **Step 1: Create `src/pages/sermons/ask.astro`**

```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import PageHero from '../../components/PageHero.astro';
import { env } from '../../lib/runtime';
import { getAllSettings } from '../../lib/db/settings';
import { getAllContent } from '../../lib/db/content';
import { makeImage } from '../../lib/content/content';
import { SITE } from '../../lib/seo';
import { feature } from '../../config/church';

if (!feature('ai')) return Astro.redirect('/');

let siteKey = '1x00000000000000000000AA';
let cimg = makeImage({});
try {
  const settings = await getAllSettings(env.DB);
  siteKey = settings.turnstile_site_key ?? siteKey;
  cimg = makeImage(await getAllContent(env.DB).catch(() => ({})));
} catch {
  // settings/content unavailable in some envs — keep dev defaults
}
---
<PublicLayout
  title={`Ask the Pastor | ${SITE.name}`}
  description={`Ask a question and get an answer grounded in the sermons of ${SITE.name}.`}
>
  <PageHero image={cimg('pages.sermons_hero')} height="h-[300px] md:h-[380px]">
    <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block hero-shadow">Sermon Library</span>
    <h1 class="font-display text-display-mobile md:text-display-lg text-white hero-shadow">Ask the Pastor</h1>
    <p class="font-body text-body-lg text-white/85 max-w-2xl mx-auto mt-4 hero-shadow">
      Ask a question and get an answer drawn from our sermons — with links to the messages it comes from.
    </p>
  </PageHero>

  <section class="py-16 md:py-24 px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto">
    <form id="ask-form" class="space-y-5">
      <textarea
        id="ask-question"
        name="question"
        rows="3"
        maxlength="500"
        required
        placeholder="e.g. What does the Bible say about anxiety?"
        class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary"
      ></textarea>
      <div class="cf-turnstile" data-sitekey={siteKey}></div>
      <button
        type="submit"
        id="ask-submit"
        class="bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-8 py-3 hover:bg-secondary transition-all disabled:opacity-50"
      >
        Ask
      </button>
    </form>

    <p id="ask-status" class="mt-10 hidden font-body text-body-md text-stone-gray" aria-live="polite"></p>

    <article id="ask-answer" class="mt-10 hidden">
      <div class="bg-surface-container-lowest border-t-2 border-heritage-gold p-8 shadow-[0_10px_30px_-10px_rgba(26,43,66,0.1)]">
        <h2 class="font-label-sm uppercase tracking-widest text-heritage-gold mb-4">Answer</h2>
        <p id="ask-answer-text" class="font-body text-body-lg text-primary leading-relaxed whitespace-pre-line"></p>
      </div>
      <div id="ask-citations" class="mt-8 space-y-3"></div>
    </article>
  </section>

  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script is:inline>
    const form = document.getElementById('ask-form');
    const status = document.getElementById('ask-status');
    const answer = document.getElementById('ask-answer');
    const answerText = document.getElementById('ask-answer-text');
    const citations = document.getElementById('ask-citations');
    const submit = document.getElementById('ask-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = document.getElementById('ask-question').value.trim();
      if (!question) return;
      const tokenEl = form.querySelector('[name="cf-turnstile-response"]');
      const token = tokenEl ? tokenEl.value : '';

      answer.classList.add('hidden');
      citations.innerHTML = '';
      status.classList.remove('hidden');
      status.textContent = 'Searching the sermons and writing an answer…';
      submit.disabled = true;

      try {
        const res = await fetch('/api/ai/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: question, 'cf-turnstile-response': token }),
        });
        const data = await res.json();
        if (!res.ok) {
          status.textContent = data.error || 'Something went wrong. Please try again.';
        } else {
          status.classList.add('hidden');
          answerText.textContent = data.answer || '';
          for (const c of data.citations || []) {
            const a = document.createElement('a');
            a.href = '/sermons/' + c.slug;
            a.className = 'block bg-surface border border-champagne px-5 py-4 hover:border-heritage-gold transition-all';
            const title = document.createElement('div');
            title.className = 'font-display text-headline-md text-primary';
            title.textContent = c.title;
            a.appendChild(title);
            const metaText = [c.speaker, c.scripture_ref].filter(Boolean).join(' · ');
            if (metaText) {
              const m = document.createElement('div');
              m.className = 'font-body text-body-md text-stone-gray mt-1';
              m.textContent = metaText;
              a.appendChild(m);
            }
            citations.appendChild(a);
          }
          answer.classList.remove('hidden');
        }
      } catch {
        status.textContent = 'Network error. Please try again.';
      } finally {
        submit.disabled = false;
        if (window.turnstile) window.turnstile.reset();
      }
    });
  </script>
</PublicLayout>
```

- [ ] **Step 2: Add the CTA to `src/pages/sermons/index.astro`** — insert immediately after the search `</form>` (the `</form>` that closes the `method="get"` search form, before the `{ q && (` results block):

```astro
    {
      feature('ai') && (
        <div class="max-w-xl mx-auto -mt-8 mb-12 text-center">
          <a
            href="/sermons/ask"
            class="inline-flex items-center gap-2 font-label-md uppercase tracking-widest text-primary border-b border-heritage-gold pb-1 hover:text-heritage-gold transition-all"
          >
            Ask the Pastor a question →
          </a>
        </div>
      )
    }
```
(`src/pages/sermons/index.astro` already imports `feature` from `../../config/church`.)

- [ ] **Step 3: Build to confirm both render without error**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/sermons/ask.astro src/pages/sermons/index.astro
git commit -m "feat: /sermons/ask page (grounded Q&A + citations) + CTA on sermons"
```

---

## Task 6: Final gate

**Files:** none (verification).

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: PASS — prior 209 + 9 new ask tests = 218, all green.

- [ ] **Step 2: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 3: Confirm clean tree**

Run: `git status --short`
Expected: empty.

---

## Task 7: Finish

- [ ] **Step 1:** Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- [ ] **Step 2:** REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch — verify tests, present options, execute the chosen one (expected: merge `feat/C2-ask-the-pastor` → `main`; do NOT deploy to Kharis).

---

## Definition of Done
- `/sermons/ask` renders when `feature('ai')` (redirects to `/` when off); accepts a question; shows a grounded answer + citation cards linking to `/sermons/{slug}`; loading state while waiting.
- `POST /api/ai/ask` enforces feature gate (404) + Turnstile (403) + validation (400) and returns `{ answer, citations }`.
- No-match questions return `FALLBACK_ANSWER` without invoking the LLM (proven by unit test).
- `npx vitest run` green (218); `npx astro build` passes.
- Merges to `main`; not deployed to Kharis. **Live verification (post-merge, manual on the deployed Worker):** with `feature('ai')` on and sermons reindexed, ask a question → grounded answer + citations; an off-topic question → fallback.

**Next:** roadmap D (community & care: prayer wall + connect workflow), F (member accounts), or G (PWA + push).
```
