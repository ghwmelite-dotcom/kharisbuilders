# D2: Connect / Next-Steps Card — Design Spec

**Date:** 2026-06-05
**Status:** Approved (brainstorming)
**Roadmap:** Phase D (Community & Care), sub-project 2 of 5.
**Working dir:** `stitch_kharisbuilders_church_web_design`

## 1. Goal

A public `/connect` page where a visitor picks one or more **next steps** (I'm new, I made a decision,
baptism, join a group, serve, prayer, …) and leaves their contact details — captured for staff
follow-up. Reuses the existing `community` feature flag (added in D1) and the standard form-handler
pipeline. Denomination-neutral, template-ready.

## 2. What already exists (reused)

- Form-handler pattern: `handleX(env, form, ip)` = zod → `verifyTurnstile` → insert → `notifyStaff` →
  redirect (see `visit-handler.ts`, `live/prayer-handler.ts`, `live/online-connect-handler.ts`).
- `feature('community')` flag (D1) — already present on `main` and `kharis`; **no config-structure
  change needed this time.**
- `notifyStaff` (best-effort email), `verifyTurnstile`, `requireAdmin`/`getAdminEmail`, `createTestDb`.

## 3. Data model

**Migration `0021_connections.sql`:**
```sql
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  steps TEXT NOT NULL DEFAULT '[]',   -- JSON array of next-step keys
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new | in_progress | done
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 4. Components

### 4.1 Next-steps registry — `src/lib/connect/steps.ts`

Single source of truth (full pastoral set, neutral wording):
```
new        -> "I'm new here"
decision   -> "I made a decision to follow Jesus"
rededicate -> "I recommitted my life"
baptism    -> "I'd like to be baptized"
membership -> "I want to become a member"
group      -> "I'd like to join a group"
serve      -> "I want to serve / volunteer"
prayer     -> "I'd like prayer or a call from a pastor"
```
Exports: `NEXT_STEPS` (array of `{ key, label }`), `STEP_KEYS` (string[]), `stepLabel(key): string`
(returns the label or the key if unknown). The form, the handler's filter, and the admin chips all
derive from this — one place to edit.

### 4.2 Schema — `ConnectInputSchema` (in `src/lib/db/schemas.ts`)

```ts
export const ConnectInputSchema = z.object({
  name: z.string().trim().min(1, 'Please add your name').max(120),
  email: z.string().trim().email('Please add a valid email').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  steps: z.array(z.string()).default([]),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
});
```
(Step values are validated by *filtering to `STEP_KEYS`* in the handler, not by `z.enum`, so an unknown
key is dropped rather than failing the whole submission.)

### 4.3 Data access — `src/lib/db/connections.ts`

- `Connection` = `{ id, name, email, phone, steps: string[], message, status, created_at }`.
- `createConnection(db, input)` — `input` carries `steps: string[]`; stores `JSON.stringify(steps)`.
- `listConnections(db, limit = 200)` — newest first; **parses `steps` JSON back to `string[]`** (falls
  back to `[]` on bad JSON).
- `setConnectionStatus(db, id, status: 'new'|'in_progress'|'done')`.
- `deleteConnection(db, id)`.

### 4.4 Handler — `src/lib/connect/connect-handler.ts`

`handleConnect(env, form, ip): { status, redirect }`:
1. `steps = form.getAll('steps').map(String).filter((k) => STEP_KEYS.includes(k))`.
2. Parse with `ConnectInputSchema` (name/email/phone/message + the filtered steps).
3. **Require `steps.length >= 1 || message`** (non-empty) — else `redirect: '/connect?connect=err'`.
4. `verifyTurnstile` → fail → `/connect?connect=err`.
5. `createConnection` → `notifyStaff('New connect card', \`${name} (${email}) — ${stepLabels.join(', ') || 'message only'}\`)`.
6. `/connect?connect=ok`.
Pure (no Astro imports) — unit-tested.

### 4.5 Public page — `src/pages/connect.astro`

- `if (!feature('community')) return Astro.redirect('/')`.
- `PageHero` "Take Your Next Step" + intro.
- A card (`<form method="POST" action="/api/forms/connect">`): the 8 next steps as checkboxes
  (`name="steps" value="{key}"`), name (required), email (required), phone (optional), message
  (textarea), Turnstile widget, submit. Success/err banner from `?connect=ok|err`.

### 4.6 API route — `src/pages/api/forms/connect.ts`

`POST` → `handleConnect(env, form, ip)` → `Response(null, { status, headers: { Location } })`.

### 4.7 Discovery (no nav item)

- **Home CTA band** in `src/pages/index.astro`, gated `feature('community')`: a warm "Not sure where to
  start? Take your next step." section with a button to `/connect`.
- **Footer link** in `src/components/Footer.astro`: add "Next Steps" → `/connect` to the Explore list,
  rendered only when `feature('community')`.

### 4.8 Admin — moderation + export

- `src/pages/admin/connect.astro` (gated via `getAdminEmail`): lists connections with the selected
  steps as chips (`stepLabel`), name/email/phone, message, a status badge, actions (mark
  **In progress** / **Done** / reopen to **New**, **Delete**), and an "Export CSV" link.
- `src/pages/api/admin/connect.ts` (`requireAdmin` → 403): `action ∈ {status, delete}` (+ `value` for
  status) + `id` → `setConnectionStatus`/`deleteConnection`; 303 back to `/admin/connect`.
- `src/pages/admin/connect.csv.ts` (`requireAdmin`): streams a CSV of all connections (name, email,
  phone, steps, message, status, created_at) with a **formula-injection guard** (prefix a leading
  `= + - @` with `'`), matching the giving CSV.
- Admin nav: add "Connect" gated by `community` (in `AdminLayout.astro`).

## 5. Testing

Offline (Vitest + Miniflare `createTestDb`):
- `steps.test.ts`: keys unique; `stepLabel('serve')` returns the label; `stepLabel('zzz')` returns `'zzz'`.
- `connections.test.ts`: `createConnection` stores steps as JSON; `listConnections` parses them back to
  an array and is newest-first; bad JSON in a row → `[]`; `setConnectionStatus` + `deleteConnection`.
- `connect-handler.test.ts`: valid (with steps) → `/connect?connect=ok` + a row stored with the steps;
  message-only (no steps) → ok; **empty (no steps, no message) → `/connect?connect=err`** and nothing
  stored; unknown step keys are filtered out of the stored row; bad Turnstile → err.

Pages/routes verified by `astro build`; live path verified post-deploy.

## 6. Definition of Done

- `/connect` renders when `feature('community')` (redirects when off); submitting captures a connection
  (steps + contact + message), notifies staff (best-effort), and shows the success banner.
- Home CTA + footer link appear only when `community` is on.
- Admin can view, change status, delete, and export CSV.
- Migration `0021` applied locally; `npx vitest run` green (current 226 + new); `npx astro build` passes.
- Merges to `main`; ships to Kharis via `merge main` + apply `0021` remote + deploy (no config-structure
  change this time — `community` already exists on `kharis`).

## 7. Open questions (resolved)

- Discovery = home CTA + footer link, no nav item. ✔
- Options = full pastoral set (8). ✔
- Dedicated `connections` table (not the `visitors` table) — multi-select steps don't fit `visitors`. ✔
- Follow-up = `notifyStaff` email (no Queues). ✔
- A submission needs at least one step **or** a message. ✔
- CSV export included. ✔
