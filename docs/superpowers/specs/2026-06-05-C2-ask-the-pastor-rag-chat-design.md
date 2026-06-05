# C2: "Ask the Pastor" RAG Chat — Design Spec

**Date:** 2026-06-05
**Status:** Approved (brainstorming)
**Depends on:** C1 (AI sermon assistant — embeddings, Vectorize index, `AIClient`/`VectorStore` adapters, `searchSermonIds`, `getPublishedSermonsByIds`)
**Working dir:** `stitch_kharisbuilders_church_web_design`

## 1. Goal

A `/sermons/ask` page where anyone types a question and receives a single, **grounded** answer drawn
from the church's published sermons, with **citations** linking back to the source sermons. It reuses
C1's retrieval + generation infrastructure end-to-end. Single-turn, non-streaming, Turnstile-guarded.

## 2. Non-goals (YAGNI)

- Multi-turn conversation / chat history.
- Streamed (token-by-token) responses.
- Caching of answers (questions are open-ended; low hit rate).
- Rate-limiting beyond Turnstile.
- Answering from anything other than published sermons (no web, no general knowledge).

## 3. Flow (single-turn RAG)

1. User submits a question + a Turnstile token from `/sermons/ask`.
2. `POST /api/ai/ask`:
   - gate on `feature('ai')` (else 404);
   - verify Turnstile (`verifyTurnstile`, `TURNSTILE_SECRET_KEY`); fail → 403;
   - validate the question (trimmed, non-empty, ≤ 500 chars); fail → 400.
3. Retrieve: `searchSermonIds({ ai, store }, question, topK=4)` → `getPublishedSermonsByIds(db, ids)`.
4. If **no** sermons retrieved: return a warm fallback answer with **empty citations** and **without
   calling the LLM** (saves cost; prevents ungrounded/​invented doctrine).
5. Otherwise build a grounded prompt from the retrieved excerpts and call `AIClient.generate`.
6. Return `{ answer, citations }` where `citations` = the retrieved sermons (`slug`, `title`,
   `speaker`, `scripture_ref`), so every answer is traceable and links back to the library.

## 4. Grounding & safety (required behaviour, not optional)

The system prompt constrains the model to:
- answer **only** from the provided sermon excerpts, in a warm, pastoral tone;
- cite sermons inline as `[1]`, `[2]` matching the numbered context blocks;
- when the excerpts don't address the question, say so plainly and suggest contacting the church —
  **never** invent theology or answer from outside the excerpts.

The no-match short-circuit (step 4) is the structural guarantee: with zero retrieved sermons the LLM
is not invoked at all.

## 5. Architecture

Pure, isolated, mostly offline-testable units (consistent with C1: pure builders unit-tested; binding
wiring thin and verified on the deployed Worker, since Workers AI + Vectorize do not resolve in
`astro dev`/build).

### 5.1 `src/lib/ai/ask.ts` (pure, no bindings)

- **`Context`** = `{ n: number; slug: string; title: string; speaker: string | null; scripture_ref: string | null; text: string }`.
- **`Citation`** = `{ slug: string; title: string; speaker: string | null; scripture_ref: string | null }`.
- **`selectContexts(sermons, opts?): Context[]`** — takes retrieved `Sermon[]`, caps to
  `opts.maxSermons` (default 4), composes each sermon's text via the existing
  `composeSermonText` and truncates to `opts.perSermonChars` (default 1200) via existing `truncate`.
  Numbers them `1..n` in retrieval order.
- **`buildAskMessages(question, contexts): { role: string; content: string }[]`** — the system prompt
  (§4) + a user message containing the question followed by the numbered context blocks
  (each: `[n] "title" — speaker (scripture)\n<text>`).
- **`FALLBACK_ANSWER`** — the warm no-match message (constant string).
- **`answerQuestion(deps, question, opts?): Promise<{ answer: string; citations: Citation[] }>`** —
  orchestrator. `deps = { ai: AIClient; store: VectorStore; fetchSermons: (ids: number[]) => Promise<Sermon[]> }`.
  Steps: `searchSermonIds({ ai, store }, question, topK)` (reused from C1) → `fetchSermons(ids)` →
  if empty return `{ answer: FALLBACK_ANSWER, citations: [] }` (no `ai.generate` call) →
  else `selectContexts` → `buildAskMessages` → `ai.generate` → `{ answer, citations }`.
  Fully testable with mocked `ai`/`store`/`fetchSermons`.

### 5.2 `src/pages/api/ai/ask.ts` (POST endpoint — thin binding wiring)

- Returns JSON. Reads `{ question, "cf-turnstile-response" }` from the request body
  (`application/json`).
- `feature('ai')` off → 404 `{ error }`.
- Turnstile invalid → 403; question invalid → 400.
- Wires `answerQuestion({ ai: workersAi(env.AI), store: vectorize(env.SERMONS), fetchSermons: (ids) => getPublishedSermonsByIds(env.DB, ids) }, question)`.
- Catches any unexpected error (e.g. the AI binding failing) → responds 200 with
  `{ answer: <friendly error message>, citations: [] }` so the UI always renders something.
  (Validation/auth failures still use their 400/403/404 codes above.)
- Client IP from `CF-Connecting-IP` passed to `verifyTurnstile`.

### 5.3 `src/pages/sermons/ask.astro` (the page)

- Redirect to `/` if `!feature('ai')`.
- Reads `turnstile_site_key` from `site_settings` (dev test key fallback, mirroring `visit.astro`).
- Renders: heading/intro, a question `<textarea>` + submit button, a Turnstile widget, an
  answer region, and a citations region. A small inline client script: on submit, render the
  Turnstile token + question as JSON to `/api/ai/ask`, show a loading state, then render the answer
  (escaped — no raw HTML injection) and citation cards linking to `/sermons/{slug}`.
- Progressive: the page is server-rendered; the answer area is populated client-side (AI bindings are
  Worker-only, so a client `fetch` to the JSON endpoint is the natural fit).

### 5.4 Discovery

- A prominent "Ask the Pastor" CTA card/button on `/sermons` (`src/pages/sermons/index.astro`).
- An "Ask" entry in the public nav, rendered only when `feature('ai') && feature('sermons')`.

## 6. Testing

`tests/ai/ask.test.ts` (vitest, offline):
- `selectContexts`: caps to `maxSermons`; truncates each to `perSermonChars`; numbers `1..n`;
  carries slug/title/speaker/scripture.
- `buildAskMessages`: system message constrains to context + forbids outside knowledge; user message
  contains the question and each numbered block.
- `answerQuestion` (mocked `ai`/`store`/`fetchSermons`):
  - hit path → returns the generated answer + citations for the retrieved sermons;
  - miss path (store returns no matches / fetch returns `[]`) → returns `FALLBACK_ANSWER` and
    **`ai.generate` is never called** (assert the mock's call count is 0);
  - citations mirror the retrieved sermons' slug/title/speaker/scripture.

No test touches D1/AI/Vectorize bindings. Live path verified on the deployed Worker after `npm run deploy`
(retrieval needs the one-time admin "Reindex AI search").

## 7. Definition of Done

- `/sermons/ask` renders (when `feature('ai')`), accepts a question, shows a grounded answer + citation
  cards; redirects to `/` when the feature is off.
- `POST /api/ai/ask` enforces feature gate + Turnstile + validation and returns `{ answer, citations }`.
- No-match questions return the fallback without invoking the LLM.
- `npx vitest run` green (existing 209 + new ask tests); `npx astro build` passes.
- Gated by `feature('ai')` throughout; merges to `main`; not deployed to Kharis (Kharis deploys from
  the `kharis` branch). Live verification is a post-merge manual step on the deployed Worker.

## 8. Open questions (resolved)

- Surface = dedicated `/sermons/ask` page (+ CTA on `/sermons`, conditional nav entry). ✔
- Interaction = single-turn grounded Q&A with citations. ✔
- Delivery = full response + loading state (non-streaming). ✔
- Abuse guard = Cloudflare Turnstile on submit (no separate rate-limiter). ✔
- No-match behaviour = warm fallback, LLM not called. ✔
