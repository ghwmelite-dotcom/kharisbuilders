# Phase B1: Paystack One-Time Giving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors give one-time gifts in GHS via Paystack (mobile money/USSD/card), with admin-managed fund designations, a signed webhook as source of truth, and an admin donations view — fully built/tested against mocks, needing real Paystack keys only for live verification.

**Architecture:** Paystack Standard (redirect) flow, server-initialized. Pure, dependency-injected libraries (money, reference, HMAC-SHA512 signature, Paystack HTTP client, webhook dispatcher, initialize pipeline) carry the logic and are unit-tested offline; D1 data access (`funds`, `donations`) is tested via the Miniflare harness. Astro routes are thin: a public `/giving` form → `/api/giving/initialize` (CSRF+Turnstile) → Paystack → `/giving/callback` (verify) + `/api/webhooks/paystack` (signed, idempotent). Admin gets gated funds CRUD and a donations view with CSV.

**Tech Stack:** Astro 6 SSR, Cloudflare D1, WebCrypto (HMAC-SHA512), zod v4, Vitest + Miniflare. Spec: `docs/superpowers/specs/2026-06-03-paystack-giving-design.md`.

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo; branch `feat/phaseB1-giving` off `main`).

> **Conventions (verified in codebase):**
> - Bindings via `import { env } from '../lib/runtime'` in routes; NEVER import runtime/`cloudflare:workers` in tests. Keep logic in functions taking `env`/`db`/`fetch` params.
> - D1 enforces FKs under Miniflare. Datetimes are UTC `datetime('now')`. Test harness applies every `migrations/*.sql` (sorted), not seed files.
> - Turnstile: `verifyTurnstile(secret, token, ip)` in `src/lib/turnstile.ts`; form field `cf-turnstile-response`; dev test keys site `1x00000000000000000000AA` / secret `1x0000000000000000000000000000000AA` (always pass). `.dev.vars` is gitignored.
> - Astro CSRF `checkOrigin` only guards form-encoded POSTs; the JSON webhook (application/json, no Origin) is not blocked. curl form tests need `-H "Origin: http://localhost:4321"`.
> - Cloudflare Access covers only `/admin` + `/api/admin`. The webhook lives at `/api/webhooks/paystack` (public, as required).
> - Admin auth: `getAdminEmail(request, env, import.meta.env.DEV)` on pages; `requireAdmin(request, env, import.meta.env.DEV)` in `/api/admin/*` routes. Slugs via `slugify`/`uniqueSlug` in `src/lib/slug.ts`.
> - `getSetting(db, key)` / `getAllSettings(db)` / `setSettings(db, entries)` in `src/lib/db/settings.ts`. `SITE` + `absUrl` in `src/lib/seo.ts`.

---

## File Structure (created/modified)

```
migrations/0007_funds.sql                 # funds table
migrations/0008_donations.sql             # donations table + indexes
db/seed_funds.sql                         # 4 starter funds (not a migration)

src/lib/giving/money.ts                   # toMinorUnits/fromMinorUnits/formatAmount/validateAmount
src/lib/giving/reference.ts               # makeReference()
src/lib/paystack/signature.ts             # hmacSha512Hex + verifyWebhookSignature (WebCrypto)
src/lib/paystack/client.ts                # initializeTransaction / verifyTransaction (injected fetch)
src/lib/giving/webhook-handler.ts         # handlePaystackEvent(db, event)
src/lib/giving/initialize-handler.ts      # handleInitialize(env, form, ip, deps)
src/lib/db/funds.ts                        # funds data access
src/lib/db/donations.ts                    # donations data access
src/lib/db/schemas.ts                      # +FundInputSchema +DonationInputSchema

src/pages/giving.astro                     # public giving page
src/pages/api/giving/initialize.ts         # POST -> Paystack init -> redirect
src/pages/giving/callback.astro            # verify reference -> thank-you/pending/failed
src/pages/api/webhooks/paystack.ts         # signed webhook -> dispatch

src/components/admin/FundForm.astro        # admin fund create/edit form
src/pages/api/admin/funds.ts               # gated funds CRUD
src/pages/admin/funds.astro                # funds list
src/pages/admin/funds/new.astro            # new fund
src/pages/admin/funds/[id].astro           # edit fund
src/pages/admin/giving.astro               # donations table + totals per fund
src/pages/admin/giving.csv.ts              # CSV export
src/layouts/AdminLayout.astro              # +Funds +Giving nav items

tests/giving/money.test.ts
tests/giving/reference.test.ts
tests/paystack/signature.test.ts
tests/paystack/client.test.ts
tests/giving/webhook-handler.test.ts
tests/giving/initialize-handler.test.ts
tests/db/funds.test.ts
tests/db/donations.test.ts
```

---

## Task 1: migrations + fund seed

**Files:** Create `migrations/0007_funds.sql`, `migrations/0008_donations.sql`, `db/seed_funds.sql`.

- [ ] **Step 1: Write `migrations/0007_funds.sql`**

```sql
CREATE TABLE IF NOT EXISTS funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

- [ ] **Step 2: Write `migrations/0008_donations.sql`**

```sql
CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  fund_id INTEGER REFERENCES funds(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'one_time',
  status TEXT NOT NULL DEFAULT 'pending',
  channel TEXT,
  paystack_status TEXT,
  paid_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_fund ON donations(fund_id);
CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at);
```

- [ ] **Step 3: Write `db/seed_funds.sql`**

```sql
INSERT OR IGNORE INTO funds (name, slug, description, sort_order, active) VALUES
  ('General Offering', 'general-offering', 'Support the general work and mission of the church.', 1, 1),
  ('Tithe', 'tithe', 'Return your tithe to the storehouse.', 2, 1),
  ('Building Fund', 'building-fund', 'Help us build and maintain our place of worship.', 3, 1),
  ('Missions & Outreach', 'missions-outreach', 'Fuel local and global outreach.', 4, 1);
```

- [ ] **Step 4: Apply locally + verify the harness picks them up**

```bash
npx wrangler d1 migrations apply kharisbuilders --local
npx wrangler d1 execute kharisbuilders --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('funds','donations');"
```
Expected: both tables listed. (The test harness auto-applies all migrations; no seed in tests.)

- [ ] **Step 5: Commit**

```bash
git add migrations/0007_funds.sql migrations/0008_donations.sql db/seed_funds.sql
git commit -m "feat: funds + donations migrations and fund seed"
```

---

## Task 2: money helpers (TDD)

**Files:** Create `src/lib/giving/money.ts`, `tests/giving/money.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/giving/money.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { toMinorUnits, fromMinorUnits, formatAmount, validateAmount, MIN_MAJOR, MAX_MAJOR } from '../../src/lib/giving/money';

describe('toMinorUnits / fromMinorUnits', () => {
  it('converts major to integer minor units (rounding)', () => {
    expect(toMinorUnits(100)).toBe(10000);
    expect(toMinorUnits(50.5)).toBe(5050);
    expect(toMinorUnits(0.1)).toBe(10);
  });
  it('round-trips', () => {
    expect(fromMinorUnits(5050)).toBe(50.5);
  });
});

describe('formatAmount', () => {
  it('formats minor units with currency + 2dp', () => {
    expect(formatAmount(10000, 'GHS')).toBe('GHS 100.00');
    expect(formatAmount(5050)).toBe('GHS 50.50');
  });
});

describe('validateAmount', () => {
  it('accepts a valid amount and returns minor units', () => {
    expect(validateAmount('100')).toEqual({ ok: true, minor: 10000 });
    expect(validateAmount('50.50')).toEqual({ ok: true, minor: 5050 });
    expect(validateAmount('1,000')).toEqual({ ok: true, minor: 100000 });
  });
  it('rejects non-numeric / NaN / negative', () => {
    expect(validateAmount('abc').ok).toBe(false);
    expect(validateAmount('').ok).toBe(false);
    expect(validateAmount('-5').ok).toBe(false);
  });
  it('enforces min and max', () => {
    expect(validateAmount(String(MIN_MAJOR - 0.5)).ok).toBe(false);
    expect(validateAmount(String(MAX_MAJOR + 1)).ok).toBe(false);
    expect(validateAmount(String(MIN_MAJOR)).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail** (`npx vitest run tests/giving/money.test.ts`).

- [ ] **Step 3: Implement `src/lib/giving/money.ts`**

```ts
export const MIN_MAJOR = 1;
export const MAX_MAJOR = 100_000;

export function toMinorUnits(major: number): number {
  return Math.round(major * 100);
}

export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

export function formatAmount(minor: number, currency = 'GHS'): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export type AmountResult = { ok: true; minor: number } | { ok: false; error: string };

/** Parse a user-entered major-unit amount, validate bounds, return integer minor units. */
export function validateAmount(input: string | number): AmountResult {
  const n = typeof input === 'number' ? input : parseFloat(String(input).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return { ok: false, error: 'Please enter a valid amount.' };
  const rounded = Math.round(n * 100) / 100;
  if (rounded < MIN_MAJOR) return { ok: false, error: `Minimum gift is GHS ${MIN_MAJOR}.` };
  if (rounded > MAX_MAJOR) return { ok: false, error: `Maximum gift is GHS ${MAX_MAJOR.toLocaleString()}.` };
  return { ok: true, minor: Math.round(rounded * 100) };
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: giving money helpers (validate/convert/format) with tests`.

---

## Task 3: reference helper (TDD)

**Files:** Create `src/lib/giving/reference.ts`, `tests/giving/reference.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeReference } from '../../src/lib/giving/reference';

describe('makeReference', () => {
  it('produces a kb_-prefixed 24-hex-char reference', () => {
    expect(makeReference()).toMatch(/^kb_[0-9a-f]{24}$/);
  });
  it('is unique across many calls', () => {
    const set = new Set(Array.from({ length: 2000 }, () => makeReference()));
    expect(set.size).toBe(2000);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/giving/reference.ts`**

```ts
/** Unguessable unique transaction reference. DB UNIQUE constraint is the final guard. */
export function makeReference(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `kb_${rand}`;
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: giving reference generator with tests`.

---

## Task 4: webhook signature (TDD, WebCrypto HMAC-SHA512)

**Files:** Create `src/lib/paystack/signature.ts`, `tests/paystack/signature.test.ts`.

- [ ] **Step 1: Write the failing test** — uses Node's `crypto` as an INDEPENDENT oracle (not our impl)

```ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature, hmacSha512Hex } from '../../src/lib/paystack/signature';

const secret = 'sk_test_abc123';
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'kb_x' } });
const goodSig = createHmac('sha512', secret).update(body).digest('hex');

describe('hmacSha512Hex', () => {
  it('matches Node crypto for the same input', async () => {
    expect(await hmacSha512Hex(body, secret)).toBe(goodSig);
  });
});

describe('verifyWebhookSignature', () => {
  it('accepts a correct signature', async () => {
    expect(await verifyWebhookSignature(body, goodSig, secret)).toBe(true);
  });
  it('rejects a tampered body', async () => {
    expect(await verifyWebhookSignature(body + ' ', goodSig, secret)).toBe(false);
  });
  it('rejects a wrong secret', async () => {
    expect(await verifyWebhookSignature(body, goodSig, 'sk_test_wrong')).toBe(false);
  });
  it('rejects an empty signature', async () => {
    expect(await verifyWebhookSignature(body, '', secret)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/paystack/signature.ts`**

```ts
const encoder = new TextEncoder();

/** Hex HMAC-SHA512 of `message` keyed by `secret`, via WebCrypto (Workers + Node 18+). */
export async function hmacSha512Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Verify Paystack's `x-paystack-signature` (HMAC-SHA512 of the raw body, keyed by the secret key). */
export async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await hmacSha512Hex(rawBody, secret);
  return timingSafeEqualHex(expected, signature);
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: Paystack webhook HMAC-SHA512 signature verification with tests`.

---

## Task 5: funds data access (TDD)

**Files:** Modify `src/lib/db/schemas.ts`; create `src/lib/db/funds.ts`, `tests/db/funds.test.ts`.

- [ ] **Step 1: Add `FundInputSchema` to `src/lib/db/schemas.ts`** (append)

```ts
export const FundInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
  // default(false): an unchecked checkbox is ABSENT from the form, so it must
  // resolve to false (the FundForm checks the box by default on NEW funds, so
  // creating a fund is active; unchecking on edit correctly deactivates).
  active: z.coerce.boolean().default(false),
});
export type FundInput = z.infer<typeof FundInputSchema>;
```

- [ ] **Step 2: Write the failing test** (`tests/db/funds.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createFund, updateFund, deleteFund, setFundActive,
  listActiveFunds, listAllFunds, getFundById,
} from '../../src/lib/db/funds';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

const base = { name: 'Building Fund', slug: '', description: 'For the building', sort_order: 2, active: true };

describe('funds data access', () => {
  it('creates with unique slug + records updated_by', async () => {
    const id1 = await createFund(ctx.db, base, 'a@x');
    const id2 = await createFund(ctx.db, { ...base }, 'a@x'); // slug collision
    expect((await getFundById(ctx.db, id1))?.slug).toBe('building-fund');
    expect((await getFundById(ctx.db, id2))?.slug).toBe('building-fund-2');
  });
  it('lists active vs all and respects sort_order', async () => {
    const hidden = await createFund(ctx.db, { ...base, name: 'Hidden', active: false }, 'a@x');
    const active = await listActiveFunds(ctx.db);
    const all = await listAllFunds(ctx.db);
    expect(active.find((f) => f.id === hidden)).toBeUndefined();
    expect(all.find((f) => f.id === hidden)).toBeDefined();
  });
  it('updates, toggles active, and deletes', async () => {
    const id = await createFund(ctx.db, { ...base, name: 'Temp', slug: 'temp' }, 'a@x');
    await updateFund(ctx.db, id, { ...base, name: 'Temp Renamed', slug: 'temp' }, 'b@x');
    expect((await getFundById(ctx.db, id))?.name).toBe('Temp Renamed');
    await setFundActive(ctx.db, id, false);
    expect((await getFundById(ctx.db, id))?.active).toBe(0);
    await deleteFund(ctx.db, id);
    expect(await getFundById(ctx.db, id)).toBeNull();
  });
});
```

- [ ] **Step 3: Run → fail.**

- [ ] **Step 4: Implement `src/lib/db/funds.ts`**

```ts
import type { FundInput } from './schemas';
import { slugify, uniqueSlug } from '../slug';

export interface Fund {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: number;
}
export interface FundFull extends Fund {
  updated_by: string | null;
}

const COLS = 'id, name, slug, description, sort_order, active';

export async function listActiveFunds(db: D1Database): Promise<Fund[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM funds WHERE active = 1 ORDER BY sort_order ASC, name ASC`)
    .all<Fund>();
  return results;
}

export async function listAllFunds(db: D1Database): Promise<Fund[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM funds ORDER BY sort_order ASC, name ASC`).all<Fund>();
  return results;
}

export async function getFundById(db: D1Database, id: number): Promise<FundFull | null> {
  const row = await db.prepare(`SELECT ${COLS}, updated_by FROM funds WHERE id = ?`).bind(id).first<FundFull>();
  return row ?? null;
}

async function resolveSlug(db: D1Database, desired: string, name: string, excludeId?: number): Promise<string> {
  const base = slugify(desired || name);
  const exists = async (s: string) => {
    const row = await db.prepare('SELECT id FROM funds WHERE slug = ?').bind(s).first<{ id: number }>();
    return row != null && row.id !== excludeId;
  };
  return uniqueSlug(exists, base);
}

export async function createFund(db: D1Database, input: FundInput, email: string): Promise<number> {
  const slug = await resolveSlug(db, input.slug ?? '', input.name);
  const r = await db
    .prepare(
      `INSERT INTO funds (name, slug, description, sort_order, active, updated_by) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.name, slug, input.description || null, input.sort_order, input.active ? 1 : 0, email)
    .run();
  return Number(r.meta.last_row_id);
}

export async function updateFund(db: D1Database, id: number, input: FundInput, email: string): Promise<void> {
  const slug = await resolveSlug(db, input.slug ?? '', input.name, id);
  await db
    .prepare(
      `UPDATE funds SET name=?, slug=?, description=?, sort_order=?, active=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(input.name, slug, input.description || null, input.sort_order, input.active ? 1 : 0, email, id)
    .run();
}

export async function setFundActive(db: D1Database, id: number, active: boolean): Promise<void> {
  await db.prepare("UPDATE funds SET active=?, updated_at=datetime('now') WHERE id=?").bind(active ? 1 : 0, id).run();
}

export async function deleteFund(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM funds WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 5: Run → pass.**

- [ ] **Step 6: Commit** `feat: funds data access + FundInputSchema with tests`.

---

## Task 6: donations data access (TDD)

**Files:** Create `src/lib/db/donations.ts`, `tests/db/donations.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/db/donations.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import {
  createPendingDonation, getDonationByReference, markDonationSuccess, markDonationFailed,
  listDonations, totalsByFund, donationTotals,
} from '../../src/lib/db/donations';

let ctx: TestDb;
let fundId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(ctx.db, { name: 'General', slug: 'general', description: '', sort_order: 1, active: true }, 'a@x');
});
afterAll(async () => { await ctx.dispose(); });

describe('donations data access', () => {
  it('creates a pending donation and reads it back', async () => {
    await createPendingDonation(ctx.db, {
      reference: 'kb_ref1', email: 'g@x.com', name: 'Gift Giver', amount: 10000, currency: 'GHS', fund_id: fundId, type: 'one_time', metadata: '{}',
    });
    const d = await getDonationByReference(ctx.db, 'kb_ref1');
    expect(d?.status).toBe('pending');
    expect(d?.amount).toBe(10000);
  });

  it('marks success idempotently (pending->success only once)', async () => {
    await markDonationSuccess(ctx.db, 'kb_ref1', { channel: 'mobile_money', paystackStatus: 'success', paidAt: '2026-06-03 10:00:00' });
    const first = await getDonationByReference(ctx.db, 'kb_ref1');
    expect(first?.status).toBe('success');
    expect(first?.channel).toBe('mobile_money');
    // Second call must not change paid_at or status
    await markDonationSuccess(ctx.db, 'kb_ref1', { channel: 'card', paystackStatus: 'success', paidAt: '2026-06-03 11:00:00' });
    const second = await getDonationByReference(ctx.db, 'kb_ref1');
    expect(second?.channel).toBe('mobile_money'); // unchanged
    expect(second?.paid_at).toBe('2026-06-03 10:00:00');
  });

  it('marks failed', async () => {
    await createPendingDonation(ctx.db, { reference: 'kb_ref2', email: 'h@x.com', name: '', amount: 5000, currency: 'GHS', fund_id: fundId, type: 'one_time', metadata: '{}' });
    await markDonationFailed(ctx.db, 'kb_ref2', { paystackStatus: 'failed' });
    expect((await getDonationByReference(ctx.db, 'kb_ref2'))?.status).toBe('failed');
  });

  it('totals count only successful donations', async () => {
    const totals = await donationTotals(ctx.db);
    expect(totals.total).toBe(10000); // ref1 only
    expect(totals.count).toBe(1);
    const byFund = await totalsByFund(ctx.db);
    expect(byFund.find((r) => r.fund_id === fundId)?.total).toBe(10000);
  });

  it('lists donations newest first', async () => {
    const list = await listDonations(ctx.db, { limit: 10, offset: 0 });
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].reference).toBeDefined();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/db/donations.ts`**

```ts
export interface DonationRow {
  id: number;
  reference: string;
  email: string;
  name: string | null;
  amount: number;
  currency: string;
  fund_id: number | null;
  type: string;
  status: string;
  channel: string | null;
  paystack_status: string | null;
  paid_at: string | null;
  metadata: string | null;
  created_at: string;
}

export interface CreatePendingInput {
  reference: string;
  email: string;
  name: string;
  amount: number;
  currency: string;
  fund_id?: number;
  type: string;
  metadata: string;
}

const COLS =
  'id, reference, email, name, amount, currency, fund_id, type, status, channel, paystack_status, paid_at, metadata, created_at';

export async function createPendingDonation(db: D1Database, d: CreatePendingInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO donations (reference, email, name, amount, currency, fund_id, type, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(d.reference, d.email, d.name || null, d.amount, d.currency, d.fund_id ?? null, d.type, d.metadata)
    .run();
}

export async function getDonationByReference(db: D1Database, reference: string): Promise<DonationRow | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM donations WHERE reference = ?`).bind(reference).first<DonationRow>();
  return row ?? null;
}

/** Idempotent: only transitions pending -> success; sets paid_at/channel once. */
export async function markDonationSuccess(
  db: D1Database,
  reference: string,
  info: { channel?: string; paystackStatus?: string; paidAt?: string },
): Promise<void> {
  await db
    .prepare(
      `UPDATE donations SET status='success', channel=?, paystack_status=?, paid_at=?
       WHERE reference=? AND status='pending'`,
    )
    .bind(info.channel ?? null, info.paystackStatus ?? 'success', info.paidAt ?? null, reference)
    .run();
}

export async function markDonationFailed(
  db: D1Database,
  reference: string,
  info: { paystackStatus?: string },
): Promise<void> {
  await db
    .prepare(`UPDATE donations SET status='failed', paystack_status=? WHERE reference=? AND status='pending'`)
    .bind(info.paystackStatus ?? 'failed', reference)
    .run();
}

export async function listDonations(
  db: D1Database,
  opts: { limit: number; offset: number; status?: string },
): Promise<DonationRow[]> {
  if (opts.status) {
    const { results } = await db
      .prepare(`SELECT ${COLS} FROM donations WHERE status=? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(opts.status, opts.limit, opts.offset)
      .all<DonationRow>();
    return results;
  }
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM donations ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(opts.limit, opts.offset)
    .all<DonationRow>();
  return results;
}

export interface FundTotal {
  fund_id: number | null;
  fund_name: string | null;
  total: number;
  count: number;
}

export async function totalsByFund(db: D1Database): Promise<FundTotal[]> {
  const { results } = await db
    .prepare(
      `SELECT d.fund_id AS fund_id, f.name AS fund_name, SUM(d.amount) AS total, COUNT(*) AS count
       FROM donations d LEFT JOIN funds f ON f.id = d.fund_id
       WHERE d.status='success'
       GROUP BY d.fund_id ORDER BY total DESC`,
    )
    .all<FundTotal>();
  return results;
}

export async function donationTotals(db: D1Database): Promise<{ total: number; count: number }> {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM donations WHERE status='success'`)
    .first<{ total: number; count: number }>();
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: donations data access (pending/success/failed, totals) with tests`.

---

## Task 7: Paystack HTTP client (TDD, injected fetch)

**Files:** Create `src/lib/paystack/client.ts`, `tests/paystack/client.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/paystack/client.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { initializeTransaction, verifyTransaction } from '../../src/lib/paystack/client';

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

describe('initializeTransaction', () => {
  it('posts and returns the authorization url + reference', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return jsonResponse({ status: true, data: { authorization_url: 'https://paystack/checkout/xyz', access_code: 'ac', reference: 'kb_ref1' } });
    }) as unknown as typeof fetch;

    const res = await initializeTransaction(
      { email: 'g@x.com', amount: 10000, currency: 'GHS', reference: 'kb_ref1', callbackUrl: 'https://site/giving/callback', metadata: { fund_id: 1 } },
      { secret: 'sk_test', fetchFn },
    );
    expect(res).toEqual({ ok: true, authorizationUrl: 'https://paystack/checkout/xyz', accessCode: 'ac', reference: 'kb_ref1' });
    expect(captured!.url).toBe('https://api.paystack.co/transaction/initialize');
    expect((captured!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test');
    expect(JSON.parse(captured!.init.body as string)).toMatchObject({ email: 'g@x.com', amount: 10000, currency: 'GHS', reference: 'kb_ref1' });
  });

  it('returns ok:false on a Paystack error payload', async () => {
    const fetchFn = (async () => jsonResponse({ status: false, message: 'Invalid key' }, 401)) as unknown as typeof fetch;
    const res = await initializeTransaction(
      { email: 'g@x.com', amount: 10000, currency: 'GHS', reference: 'r', callbackUrl: 'c', metadata: {} },
      { secret: 'bad', fetchFn },
    );
    expect(res.ok).toBe(false);
  });

  it('returns ok:false on network error', async () => {
    const fetchFn = (async () => { throw new Error('network'); }) as unknown as typeof fetch;
    const res = await initializeTransaction(
      { email: 'g@x.com', amount: 1, currency: 'GHS', reference: 'r', callbackUrl: 'c', metadata: {} },
      { secret: 'sk', fetchFn },
    );
    expect(res.ok).toBe(false);
  });
});

describe('verifyTransaction', () => {
  it('maps a successful verification', async () => {
    const fetchFn = (async (url: string) => {
      expect(url).toBe('https://api.paystack.co/transaction/verify/kb_ref1');
      return jsonResponse({ status: true, data: { status: 'success', channel: 'mobile_money', reference: 'kb_ref1', paid_at: '2026-06-03T10:00:00Z' } });
    }) as unknown as typeof fetch;
    const res = await verifyTransaction('kb_ref1', { secret: 'sk', fetchFn });
    expect(res).toEqual({ ok: true, status: 'success', channel: 'mobile_money', reference: 'kb_ref1', paidAt: '2026-06-03T10:00:00Z' });
  });
  it('maps a failed verification', async () => {
    const fetchFn = (async () => jsonResponse({ status: true, data: { status: 'failed', channel: 'card', reference: 'r' } })) as unknown as typeof fetch;
    const res = await verifyTransaction('r', { secret: 'sk', fetchFn });
    expect(res).toEqual({ ok: true, status: 'failed', channel: 'card', reference: 'r', paidAt: undefined });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/paystack/client.ts`**

```ts
const API = 'https://api.paystack.co';

export interface PaystackConfig {
  secret: string;
  fetchFn?: typeof fetch;
}

export interface InitializeParams {
  email: string;
  amount: number; // minor units (pesewas)
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export type InitializeResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; error: string };

export async function initializeTransaction(params: InitializeParams, cfg: PaystackConfig): Promise<InitializeResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        amount: params.amount,
        currency: params.currency,
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      }),
    });
    const json = (await res.json()) as { status?: boolean; data?: { authorization_url?: string; access_code?: string; reference?: string }; message?: string };
    if (!res.ok || !json.status || !json.data?.authorization_url) {
      return { ok: false, error: json.message ?? `Paystack initialize failed (${res.status})` };
    }
    return { ok: true, authorizationUrl: json.data.authorization_url, accessCode: json.data.access_code ?? '', reference: json.data.reference ?? params.reference };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export type VerifyResult =
  | { ok: true; status: string; channel: string | null; reference: string; paidAt?: string }
  | { ok: false; error: string };

export async function verifyTransaction(reference: string, cfg: PaystackConfig): Promise<VerifyResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cfg.secret}` },
    });
    const json = (await res.json()) as { status?: boolean; data?: { status?: string; channel?: string; reference?: string; paid_at?: string }; message?: string };
    if (!res.ok || !json.status || !json.data?.status) {
      return { ok: false, error: json.message ?? `Paystack verify failed (${res.status})` };
    }
    return { ok: true, status: json.data.status, channel: json.data.channel ?? null, reference: json.data.reference ?? reference, paidAt: json.data.paid_at };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: Paystack HTTP client (initialize/verify) with injected-fetch tests`.

---

## Task 8: webhook dispatcher (TDD)

**Files:** Create `src/lib/giving/webhook-handler.ts`, `tests/giving/webhook-handler.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/giving/webhook-handler.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { createPendingDonation, getDonationByReference } from '../../src/lib/db/donations';
import { handlePaystackEvent } from '../../src/lib/giving/webhook-handler';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  const f = await createFund(ctx.db, { name: 'G', slug: 'g', description: '', sort_order: 1, active: true }, 'a@x');
  await createPendingDonation(ctx.db, { reference: 'kb_w1', email: 'g@x.com', name: '', amount: 10000, currency: 'GHS', fund_id: f, type: 'one_time', metadata: '{}' });
});
afterAll(async () => { await ctx.dispose(); });

describe('handlePaystackEvent', () => {
  it('marks the donation success on charge.success', async () => {
    await handlePaystackEvent(ctx.db, { event: 'charge.success', data: { reference: 'kb_w1', channel: 'mobile_money', status: 'success', paid_at: '2026-06-03 10:00:00' } });
    expect((await getDonationByReference(ctx.db, 'kb_w1'))?.status).toBe('success');
  });
  it('ignores unknown events', async () => {
    await handlePaystackEvent(ctx.db, { event: 'transfer.success', data: { reference: 'kb_w1' } });
    expect((await getDonationByReference(ctx.db, 'kb_w1'))?.status).toBe('success'); // unchanged
  });
  it('no-ops on unknown reference', async () => {
    await handlePaystackEvent(ctx.db, { event: 'charge.success', data: { reference: 'kb_does_not_exist', status: 'success' } });
    expect(await getDonationByReference(ctx.db, 'kb_does_not_exist')).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/giving/webhook-handler.ts`**

```ts
import { markDonationSuccess } from '../db/donations';

export interface PaystackEvent {
  event: string;
  data?: { reference?: string; channel?: string; status?: string; paid_at?: string };
}

/** Dispatch a verified Paystack webhook event. Idempotent; unknown events/refs are no-ops. */
export async function handlePaystackEvent(db: D1Database, event: PaystackEvent): Promise<void> {
  if (event.event === 'charge.success' && event.data?.reference) {
    await markDonationSuccess(db, event.data.reference, {
      channel: event.data.channel,
      paystackStatus: event.data.status,
      paidAt: event.data.paid_at,
    });
  }
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: Paystack webhook event dispatcher with tests`.

---

## Task 9: initialize pipeline (TDD)

**Files:** Modify `src/lib/db/schemas.ts` (add `DonationInputSchema`); create `src/lib/giving/initialize-handler.ts`, `tests/giving/initialize-handler.test.ts`.

- [ ] **Step 1: Add `DonationInputSchema` to `src/lib/db/schemas.ts`** (append)

```ts
export const DonationInputSchema = z.object({
  email: z.string().trim().email('Please enter a valid email').max(200),
  name: z.string().trim().max(120).optional().or(z.literal('')),
  amount: z.string().trim().min(1, 'Please enter an amount'),
  fund_id: z.coerce.number().int().positive().optional(),
});
export type DonationInput = z.infer<typeof DonationInputSchema>;
```

- [ ] **Step 2: Write the failing test** (`tests/giving/initialize-handler.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { getDonationByReference, listDonations } from '../../src/lib/db/donations';
import { handleInitialize } from '../../src/lib/giving/initialize-handler';

let ctx: TestDb;
let fundId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(ctx.db, { name: 'General', slug: 'general', description: '', sort_order: 1, active: true }, 'a@x');
});
afterAll(async () => { await ctx.dispose(); });

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

// Turnstile + Paystack fetch stub: siteverify -> success; paystack initialize -> authorization_url
const okFetch = (async (url: string) => {
  if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: true }), { status: 200 });
  return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://paystack/checkout/abc', access_code: 'ac', reference: 'X' } }), { status: 200 });
}) as unknown as typeof fetch;

const env = { DB: undefined as unknown as D1Database, PAYSTACK_SECRET_KEY: 'sk_test', TURNSTILE_SECRET_KEY: 'ts' };

describe('handleInitialize', () => {
  it('rejects invalid input before calling Paystack', async () => {
    const res = await handleInitialize({ ...env, DB: ctx.db }, form({ email: 'not-an-email', amount: '100', 'cf-turnstile-response': 'x' }), '1.1.1.1', { origin: 'https://site', fetchFn: okFetch });
    expect(res.status).toBe(303);
    expect(res.redirect).toContain('/giving?error=');
  });

  it('rejects an out-of-range amount', async () => {
    const res = await handleInitialize({ ...env, DB: ctx.db }, form({ email: 'g@x.com', amount: '0.5', fund_id: String(fundId), 'cf-turnstile-response': 'x' }), undefined, { origin: 'https://site', fetchFn: okFetch });
    expect(res.redirect).toContain('error=');
  });

  it('creates a pending donation and redirects to Paystack on success', async () => {
    const res = await handleInitialize({ ...env, DB: ctx.db }, form({ email: 'g@x.com', name: 'Gift', amount: '100', fund_id: String(fundId), 'cf-turnstile-response': 'x' }), '2.2.2.2', { origin: 'https://site', fetchFn: okFetch });
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('https://paystack/checkout/abc');
    const all = await listDonations(ctx.db, { limit: 10, offset: 0 });
    const pending = all.find((d) => d.email === 'g@x.com' && d.amount === 10000);
    expect(pending).toBeDefined();
    expect(pending!.status).toBe('pending');
    expect(await getDonationByReference(ctx.db, pending!.reference)).not.toBeNull();
  });

  it('rejects when Turnstile fails', async () => {
    const failTurnstile = (async (url: string) => {
      if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: false }), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const res = await handleInitialize({ ...env, DB: ctx.db }, form({ email: 'g@x.com', amount: '100', fund_id: String(fundId), 'cf-turnstile-response': 'x' }), undefined, { origin: 'https://site', fetchFn: failTurnstile });
    expect(res.redirect).toContain('error=');
  });
});
```

> Note: `verifyTurnstile` calls `fetch` globally (not injected). The test stub must be installed as the global `fetch` OR the handler must pass `fetchFn` to both Turnstile and Paystack. To keep Turnstile injectable, the handler calls a small local `verifyTurnstileWith(fetchFn, secret, token, ip)` wrapper that uses the injected fetch. Implement that wrapper inside the handler module (do not modify the existing `turnstile.ts`).

- [ ] **Step 3: Run → fail.**

- [ ] **Step 4: Implement `src/lib/giving/initialize-handler.ts`**

```ts
import { DonationInputSchema } from '../db/schemas';
import { validateAmount } from './money';
import { makeReference } from './reference';
import { createPendingDonation } from '../db/donations';
import { getSetting } from '../db/settings';
import { initializeTransaction } from '../paystack/client';

export interface InitializeEnv {
  DB: D1Database;
  PAYSTACK_SECRET_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface InitializeDeps {
  origin: string;
  fetchFn?: typeof fetch;
}

export interface InitializeResult {
  status: number;
  redirect: string;
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstileWith(fetchFn: typeof fetch, secret: string, token: string, ip?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new FormData();
    body.append('secret', secret);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);
    const res = await fetchFn(SITEVERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

function back(error: string): InitializeResult {
  return { status: 303, redirect: `/giving?error=${error}` };
}

/** Validate -> Turnstile -> create pending donation -> Paystack initialize -> redirect to checkout. */
export async function handleInitialize(
  env: InitializeEnv,
  form: FormData,
  ip: string | undefined,
  deps: InitializeDeps,
): Promise<InitializeResult> {
  const doFetch = deps.fetchFn ?? fetch;

  const parsed = DonationInputSchema.safeParse({
    email: form.get('email'),
    name: form.get('name') ?? '',
    amount: form.get('amount'),
    fund_id: form.get('fund_id') ?? undefined,
  });
  if (!parsed.success) return back('invalid');

  const amount = validateAmount(parsed.data.amount);
  if (!amount.ok) return back('amount');

  const token = String(form.get('cf-turnstile-response') ?? '');
  const turnstileOk = await verifyTurnstileWith(doFetch, env.TURNSTILE_SECRET_KEY ?? '', token, ip);
  if (!turnstileOk) return back('turnstile');

  const currency = (await getSetting(env.DB, 'currency').catch(() => null)) ?? 'GHS';
  const reference = makeReference();
  const metadata = { fund_id: parsed.data.fund_id ?? null, donor_name: parsed.data.name || null };

  await createPendingDonation(env.DB, {
    reference,
    email: parsed.data.email,
    name: parsed.data.name ?? '',
    amount: amount.minor,
    currency,
    fund_id: parsed.data.fund_id,
    type: 'one_time',
    metadata: JSON.stringify(metadata),
  });

  const init = await initializeTransaction(
    {
      email: parsed.data.email,
      amount: amount.minor,
      currency,
      reference,
      callbackUrl: `${deps.origin}/giving/callback`,
      metadata,
    },
    { secret: env.PAYSTACK_SECRET_KEY ?? '', fetchFn: doFetch },
  );
  if (!init.ok) return back('init');

  return { status: 303, redirect: init.authorizationUrl };
}
```

- [ ] **Step 5: Run → pass.**

- [ ] **Step 6: Commit** `feat: giving initialize pipeline (validate/turnstile/pending/init) with tests`.

---

## Task 10: public giving page + initialize route

**Files:** Create `src/pages/giving.astro`, `src/pages/api/giving/initialize.ts`.

- [ ] **Step 1: Implement `src/pages/api/giving/initialize.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { SITE } from '../../../lib/seo';
import { handleInitialize } from '../../../lib/giving/initialize-handler';

export const POST: APIRoute = async ({ request, site }) => {
  const form = await request.formData();
  const origin = (site ?? new URL(SITE.url)).origin;
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const result = await handleInitialize(env, form, ip, { origin });
  return new Response(null, { status: result.status, headers: { Location: result.redirect } });
};
```

- [ ] **Step 2: Implement `src/pages/giving.astro`** (premium, consistent with the site; reuses `PageHero`)

```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import PageHero from '../components/PageHero.astro';
import { env } from '../lib/runtime';
import { getAllSettings } from '../lib/db/settings';
import { listActiveFunds, type Fund } from '../lib/db/funds';

let funds: Fund[] = [];
let givingEnabled = false;
let siteKey = '1x00000000000000000000AA';
let currency = 'GHS';
try {
  const settings = await getAllSettings(env.DB);
  givingEnabled = settings.giving_enabled === 'true';
  siteKey = settings.turnstile_site_key ?? siteKey;
  currency = settings.currency ?? 'GHS';
  funds = await listActiveFunds(env.DB);
} catch {
  /* defaults; page degrades gracefully */
}
const presets = [50, 100, 200, 500];
const errors: Record<string, string> = {
  invalid: 'Please check your details and try again.',
  amount: 'Please enter an amount between GHS 1 and GHS 100,000.',
  turnstile: 'Please complete the verification and try again.',
  init: "We couldn't start your payment. Please try again.",
};
const errorKey = Astro.url.searchParams.get('error');
const errorMsg = errorKey ? (errors[errorKey] ?? 'Something went wrong. Please try again.') : null;
---
<PublicLayout title="Give | Kharisbuilders" description="Give to support the mission and ministries of Kharisbuilders.">
  <PageHero image="/images/home-2.jpg" height="h-[360px] md:h-[460px]">
    <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block hero-shadow">Generosity</span>
    <h1 class="font-display text-display-mobile md:text-display-lg text-white hero-shadow">Give</h1>
    <p class="font-body text-body-lg text-white/85 max-w-2xl mx-auto mt-4 hero-shadow">
      Your generosity builds lives and shapes destinies. Give securely with mobile money or card.
    </p>
  </PageHero>

  <section class="py-20 md:py-28 px-margin-mobile md:px-margin-desktop max-w-2xl mx-auto">
    {
      !givingEnabled ? (
        <div class="text-center bg-surface-container p-12">
          <h2 class="font-display text-headline-md text-primary mb-3">Online giving is coming soon</h2>
          <p class="font-body text-body-md text-stone-gray">We're setting things up. Please check back shortly.</p>
        </div>
      ) : (
        <form method="POST" action="/api/giving/initialize" class="bg-surface-container p-8 md:p-12 shadow-[0_10px_30px_-10px_rgba(26,43,66,0.12)] space-y-8" data-reveal>
          {errorMsg && <p class="bg-accent-deep/10 text-accent-deep font-body text-body-md px-4 py-3">{errorMsg}</p>}

          <div>
            <label class="font-label-sm uppercase tracking-widest text-heritage-gold block mb-3">Choose a fund</label>
            <select name="fund_id" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary">
              {funds.map((f) => <option value={String(f.id)}>{f.name}</option>)}
            </select>
          </div>

          <div>
            <label class="font-label-sm uppercase tracking-widest text-heritage-gold block mb-3">Amount ({currency})</label>
            <div class="grid grid-cols-4 gap-3 mb-3">
              {presets.map((p) => (
                <button type="button" class="amount-preset border border-champagne py-3 font-body text-body-md text-primary hover:border-heritage-gold transition-all" data-amount={String(p)}>
                  {p}
                </button>
              ))}
            </div>
            <input id="amount-input" name="amount" type="text" inputmode="decimal" required placeholder="Custom amount" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
          </div>

          <div class="grid grid-cols-1 gap-6">
            <div>
              <label for="g-name" class="font-label-sm uppercase tracking-widest text-heritage-gold block mb-2">Name (optional)</label>
              <input id="g-name" name="name" type="text" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
            </div>
            <div>
              <label for="g-email" class="font-label-sm uppercase tracking-widest text-heritage-gold block mb-2">Email (for your receipt)</label>
              <input id="g-email" name="email" type="email" required class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
            </div>
          </div>

          <div class="cf-turnstile" data-sitekey={siteKey}></div>

          <button type="submit" class="w-full bg-heritage-gold text-primary font-label-md uppercase tracking-widest py-4 hover:bg-secondary transition-all">
            Give {currency}
          </button>
          <p class="font-body text-body-sm text-stone-gray text-center">Secured by Paystack. You'll be redirected to complete your gift.</p>
        </form>
      )
    }
  </section>

  <script is:inline>
    document.querySelectorAll('.amount-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('amount-input');
        if (input) input.value = btn.getAttribute('data-amount') || '';
        document.querySelectorAll('.amount-preset').forEach((b) => b.classList.remove('border-heritage-gold'));
        btn.classList.add('border-heritage-gold');
      });
    });
  </script>
  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</PublicLayout>
```

> Gold button uses `hover:bg-secondary` (NOT `.btn-fill`) — gold-on-gold is invisible (known gotcha).

- [ ] **Step 3: Build** (`npm run build`) → succeeds.

- [ ] **Step 4: Commit** `feat: public /giving page + initialize route`.

---

## Task 11: callback page

**Files:** Create `src/pages/giving/callback.astro`.

- [ ] **Step 1: Implement `src/pages/giving/callback.astro`**

```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import { env } from '../../lib/runtime';
import { verifyTransaction } from '../../lib/paystack/client';
import { getDonationByReference, markDonationSuccess, markDonationFailed } from '../../lib/db/donations';
import { formatAmount } from '../../lib/giving/money';

const reference = Astro.url.searchParams.get('reference') ?? Astro.url.searchParams.get('trxref') ?? '';
let state: 'success' | 'pending' | 'failed' = 'pending';
let amountLabel = '';

if (reference) {
  const result = await verifyTransaction(reference, { secret: env.PAYSTACK_SECRET_KEY ?? '' }).catch(() => ({ ok: false as const, error: 'verify' }));
  if (result.ok && result.status === 'success') {
    await markDonationSuccess(env.DB, reference, { channel: result.channel ?? undefined, paystackStatus: result.status, paidAt: result.paidAt }).catch(() => {});
    state = 'success';
  } else if (result.ok && result.status === 'failed') {
    await markDonationFailed(env.DB, reference, { paystackStatus: result.status }).catch(() => {});
    state = 'failed';
  }
  const donation = await getDonationByReference(env.DB, reference).catch(() => null);
  if (donation) amountLabel = formatAmount(donation.amount, donation.currency);
}
---
<PublicLayout title="Thank you | Kharisbuilders" description="Thank you for your generosity." noindex={true}>
  <section class="min-h-[60vh] flex items-center justify-center py-24 px-6">
    <div class="text-center max-w-xl">
      {state === 'success' && (
        <>
          <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block">Gift received</span>
          <h1 class="font-display text-display-mobile md:text-headline-lg text-primary mb-4">Thank you{amountLabel ? ` for your ${amountLabel} gift` : ''}!</h1>
          <p class="font-body text-body-lg text-stone-gray mb-8">Your generosity helps build lives and shape destinies. A receipt has been sent to your email.</p>
        </>
      )}
      {state === 'pending' && (
        <>
          <h1 class="font-display text-display-mobile md:text-headline-lg text-primary mb-4">We're confirming your gift</h1>
          <p class="font-body text-body-lg text-stone-gray mb-8">If you completed payment, you'll receive a receipt shortly. This can take a moment for mobile money.</p>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1 class="font-display text-display-mobile md:text-headline-lg text-primary mb-4">Payment not completed</h1>
          <p class="font-body text-body-lg text-stone-gray mb-8">Your gift wasn't completed. No charge was made — please try again.</p>
        </>
      )}
      <a href="/giving" class="inline-flex items-center gap-3 font-label-md text-primary uppercase tracking-[0.2em] border-b border-heritage-gold pb-1">Back to giving</a>
    </div>
  </section>
</PublicLayout>
```

- [ ] **Step 2: Build** → succeeds.

- [ ] **Step 3: Commit** `feat: giving callback page (verify + thank-you/pending/failed)`.

---

## Task 12: signed webhook route

**Files:** Create `src/pages/api/webhooks/paystack.ts`.

- [ ] **Step 1: Implement `src/pages/api/webhooks/paystack.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { verifyWebhookSignature } from '../../../lib/paystack/signature';
import { handlePaystackEvent, type PaystackEvent } from '../../../lib/giving/webhook-handler';

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const signature = request.headers.get('x-paystack-signature') ?? '';
  const secret = env.PAYSTACK_SECRET_KEY ?? '';
  if (!(await verifyWebhookSignature(raw, signature, secret))) {
    return new Response('Invalid signature', { status: 401 });
  }
  let event: PaystackEvent;
  try {
    event = JSON.parse(raw) as PaystackEvent;
  } catch {
    return new Response('Bad payload', { status: 400 });
  }
  await handlePaystackEvent(env.DB, event);
  return new Response('ok', { status: 200 });
};
```

> The webhook is JSON (`application/json`), so Astro's `checkOrigin` CSRF guard does not apply, and it lives outside `/api/admin`, so Cloudflare Access does not block Paystack. No extra config.

- [ ] **Step 2: Build** → succeeds.

- [ ] **Step 3: Commit** `feat: signed Paystack webhook route`.

---

## Task 13: admin funds CRUD

**Files:** Create `src/components/admin/FundForm.astro`, `src/pages/api/admin/funds.ts`, `src/pages/admin/funds.astro`, `src/pages/admin/funds/new.astro`, `src/pages/admin/funds/[id].astro`; modify `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: Add nav items in `src/layouts/AdminLayout.astro`** (after the `settings` entry in the nav array)

```astro
  { label: 'Funds', href: '/admin/funds', key: 'funds' },
  { label: 'Giving', href: '/admin/giving', key: 'giving' },
```

- [ ] **Step 2: Implement `src/pages/api/admin/funds.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { FundInputSchema } from '../../../lib/db/schemas';
import { createFund, updateFund, deleteFund, setFundActive } from '../../../lib/db/funds';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteFund(env.DB, id);
    } else if (action === 'toggle') {
      await setFundActive(env.DB, id, String(form.get('active')) === 'true');
    } else {
      const data = FundInputSchema.parse(Object.fromEntries(form));
      if (action === 'update') await updateFund(env.DB, id, data, auth.email);
      else await createFund(env.DB, data, auth.email);
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/funds' } });
};
```

- [ ] **Step 3: Implement `src/components/admin/FundForm.astro`**

```astro
---
import Field from '../Field.astro';
import Button from '../Button.astro';
import type { FundFull } from '../../lib/db/funds';
interface Props {
  fund?: FundFull | null;
}
const { fund } = Astro.props;
const isEdit = !!fund;
---
<form method="POST" action="/api/admin/funds" class="flex flex-col gap-6 max-w-xl">
  <input type="hidden" name="_action" value={isEdit ? 'update' : 'create'} />
  {isEdit && <input type="hidden" name="id" value={String(fund!.id)} />}
  <Field label="Name" name="name" required value={fund?.name ?? ''} />
  <Field label="Slug (optional)" name="slug" value={fund?.slug ?? ''} />
  <Field label="Description" name="description" textarea value={fund?.description ?? ''} />
  <Field label="Sort order" name="sort_order" type="number" min={0} value={fund?.sort_order != null ? String(fund.sort_order) : '0'} />
  <Field label="Active" name="active" type="checkbox" checked={fund ? !!fund.active : true} />
  <Button type="submit" variant="primary">{isEdit ? 'Save' : 'Create'}</Button>
</form>
```

- [ ] **Step 4: Implement `src/pages/admin/funds.astro`** (list)

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listAllFunds } from '../../lib/db/funds';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const funds = await listAllFunds(env.DB).catch(() => []);
---
<AdminLayout title="Funds" email={email} active="funds">
  <a href="/admin/funds/new" class="inline-block mb-6 bg-primary text-on-primary px-5 py-2 text-sm uppercase tracking-wider">+ New fund</a>
  <table class="w-full text-sm">
    <thead>
      <tr class="text-left text-on-surface-variant border-b border-champagne">
        <th class="py-2">Name</th><th>Order</th><th>Status</th><th class="text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {funds.map((f) => (
        <tr class="border-b border-champagne/50">
          <td class="py-3"><a href={`/admin/funds/${f.id}`} class="text-primary hover:text-accent">{f.name}</a></td>
          <td>{f.sort_order}</td>
          <td>{f.active ? 'Active' : 'Hidden'}</td>
          <td class="text-right whitespace-nowrap">
            <form method="POST" action="/api/admin/funds" class="inline">
              <input type="hidden" name="_action" value="toggle" />
              <input type="hidden" name="id" value={String(f.id)} />
              <input type="hidden" name="active" value={f.active ? 'false' : 'true'} />
              <button class="text-accent text-xs uppercase tracking-wider">{f.active ? 'Hide' : 'Show'}</button>
            </form>
            <form method="POST" action="/api/admin/funds" class="inline ml-3" onsubmit="return confirm('Delete this fund? Existing donations keep their history.')">
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={String(f.id)} />
              <button class="text-accent-deep text-xs uppercase tracking-wider">Delete</button>
            </form>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  {funds.length === 0 && <p class="text-on-surface-variant mt-4">No funds yet.</p>}
</AdminLayout>
```

- [ ] **Step 5: Implement `src/pages/admin/funds/new.astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import FundForm from '../../../components/admin/FundForm.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
---
<AdminLayout title="New fund" email={email} active="funds">
  <FundForm />
</AdminLayout>
```

- [ ] **Step 6: Implement `src/pages/admin/funds/[id].astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import FundForm from '../../../components/admin/FundForm.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';
import { getFundById } from '../../../lib/db/funds';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const id = Number(Astro.params.id);
const fund = await getFundById(env.DB, id).catch(() => null);
if (!fund) return Astro.redirect('/admin/funds');
---
<AdminLayout title={`Edit: ${fund.name}`} email={email} active="funds">
  <FundForm fund={fund} />
</AdminLayout>
```

- [ ] **Step 7: Build** → succeeds. (Manual admin verification happens in Task 15.)

- [ ] **Step 8: Commit** `feat: admin funds CRUD (form, route, list, new/edit) + nav`.

---

## Task 14: admin giving view + CSV

**Files:** Create `src/pages/admin/giving.astro`, `src/pages/admin/giving.csv.ts`.

- [ ] **Step 1: Implement `src/pages/admin/giving.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listDonations, totalsByFund, donationTotals } from '../../lib/db/donations';
import { formatAmount } from '../../lib/giving/money';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const [donations, byFund, totals] = await Promise.all([
  listDonations(env.DB, { limit: 100, offset: 0 }).catch(() => []),
  totalsByFund(env.DB).catch(() => []),
  donationTotals(env.DB).catch(() => ({ total: 0, count: 0 })),
]);
---
<AdminLayout title="Giving" email={email} active="giving">
  <div class="flex items-center justify-between mb-6">
    <p class="text-on-surface-variant text-sm">Total received: <span class="text-primary font-medium">{formatAmount(totals.total)}</span> · {totals.count} gifts</p>
    <a href="/admin/giving.csv" class="bg-primary text-on-primary px-5 py-2 text-sm uppercase tracking-wider">Export CSV</a>
  </div>

  <h2 class="font-display text-lg text-primary mb-3">By fund</h2>
  <table class="w-full text-sm mb-10">
    <thead><tr class="text-left text-on-surface-variant border-b border-champagne"><th class="py-2">Fund</th><th>Gifts</th><th class="text-right">Total</th></tr></thead>
    <tbody>
      {byFund.map((r) => (
        <tr class="border-b border-champagne/50"><td class="py-3">{r.fund_name ?? 'Unassigned'}</td><td>{r.count}</td><td class="text-right">{formatAmount(r.total)}</td></tr>
      ))}
    </tbody>
  </table>

  <h2 class="font-display text-lg text-primary mb-3">Recent gifts</h2>
  <table class="w-full text-sm">
    <thead><tr class="text-left text-on-surface-variant border-b border-champagne"><th class="py-2">Date</th><th>Name</th><th>Email</th><th>Amount</th><th>Status</th><th>Channel</th></tr></thead>
    <tbody>
      {donations.map((d) => (
        <tr class="border-b border-champagne/50">
          <td class="py-3">{d.created_at}</td>
          <td>{d.name ?? '—'}</td>
          <td>{d.email}</td>
          <td>{formatAmount(d.amount, d.currency)}</td>
          <td>{d.status}</td>
          <td>{d.channel ?? '—'}</td>
        </tr>
      ))}
    </tbody>
  </table>
  {donations.length === 0 && <p class="text-on-surface-variant mt-4">No gifts yet.</p>}
</AdminLayout>
```

- [ ] **Step 2: Implement `src/pages/admin/giving.csv.ts`** (gated)

```ts
import type { APIRoute } from 'astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listDonations } from '../../lib/db/donations';
import { fromMinorUnits } from '../../lib/giving/money';

function csvCell(v: string | number | null): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET: APIRoute = async ({ request }) => {
  const email = getAdminEmail(request, env, import.meta.env.DEV);
  if (!email) return new Response('Forbidden', { status: 403 });
  const rows = await listDonations(env.DB, { limit: 10000, offset: 0 }).catch(() => []);
  const header = ['reference', 'created_at', 'name', 'email', 'amount', 'currency', 'status', 'channel', 'fund_id'];
  const lines = [header.join(',')];
  for (const d of rows) {
    lines.push(
      [d.reference, d.created_at, d.name, d.email, fromMinorUnits(d.amount).toFixed(2), d.currency, d.status, d.channel, d.fund_id]
        .map(csvCell)
        .join(','),
    );
  }
  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="donations.csv"' },
  });
};
```

> `/admin/giving.csv` is under `/admin`, so Cloudflare Access + the `getAdminEmail` check both gate it.

- [ ] **Step 3: Build** → succeeds.

- [ ] **Step 4: Commit** `feat: admin giving view + CSV export`.

---

## Task 15: full gate + dev verification

- [ ] **Step 1: Full unit suite** (`npx vitest run`) — prior 70 + new (~26) all pass.

- [ ] **Step 2: Build** (`npm run build`) → succeeds.

- [ ] **Step 3: Seed funds locally + enable giving for dev**

```bash
npx wrangler d1 execute kharisbuilders --local --file db/seed_funds.sql
npx wrangler d1 execute kharisbuilders --local --command "INSERT INTO site_settings (key,value) VALUES ('giving_enabled','true') ON CONFLICT(key) DO UPDATE SET value='true';"
npx wrangler d1 execute kharisbuilders --local --command "INSERT INTO site_settings (key,value) VALUES ('currency','GHS') ON CONFLICT(key) DO UPDATE SET value='GHS';"
```
Add a dev Paystack secret to `.dev.vars` so initialize doesn't fail (use the user's TEST secret if available; otherwise the initialize call returns ok:false and redirects to `/giving?error=init`, which still proves the pipeline up to Paystack):
```
PAYSTACK_SECRET_KEY=sk_test_xxx
```

- [ ] **Step 4: Dev smoke** (`npm run dev`)

```bash
# giving page renders with funds + form (giving_enabled=true)
curl -s http://localhost:4321/giving | grep -c 'name="amount"'          # 1
curl -s http://localhost:4321/giving | grep -o 'General Offering' | head -1

# webhook signature gate: unsigned -> 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4321/api/webhooks/paystack -H "content-type: application/json" -d '{"event":"charge.success","data":{"reference":"x"}}'   # 401

# webhook with a valid signature marks a pre-inserted pending donation success:
# 1) insert a pending row
npx wrangler d1 execute kharisbuilders --local --command "INSERT INTO donations (reference,email,amount,currency,type,status) VALUES ('kb_devtest','d@x.com',10000,'GHS','one_time','pending');"
# 2) compute HMAC-SHA512 of the body with the dev secret and POST it (node one-liner)
node -e "const c=require('crypto');const b=JSON.stringify({event:'charge.success',data:{reference:'kb_devtest',channel:'mobile_money',status:'success',paid_at:'2026-06-03 10:00:00'}});const s=c.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY||'sk_test_xxx').update(b).digest('hex');console.log(JSON.stringify({b,s}))" > /tmp/sig.json
# 3) POST using those values
B=$(node -e "console.log(require('/tmp/sig.json').b)"); S=$(node -e "console.log(require('/tmp/sig.json').s)")
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4321/api/webhooks/paystack -H "content-type: application/json" -H "x-paystack-signature: $S" --data "$B"   # 200
npx wrangler d1 execute kharisbuilders --local --command "SELECT status,channel FROM donations WHERE reference='kb_devtest';"   # success / mobile_money
```
Expected: giving page shows the form + funds; unsigned webhook → 401; correctly-signed webhook → 200 and flips the donation to success. (Full Paystack checkout requires the user's real test keys — Task in §10 of the spec / rollout.)

- [ ] **Step 5: Clean tree** (`git status --short`).

---

## Phase B1 Done — Definition of Done
- Migrations create `funds` + `donations`; admin can CRUD funds; four funds seeded.
- `/giving` renders a premium form (funds, amount presets + custom, email, Turnstile) gated by `giving_enabled`.
- POST initializes a server-side Paystack transaction (amount validated/converted to pesewas, our reference, pending donation row) and redirects to Paystack checkout.
- `/giving/callback` verifies the reference and shows success/pending/failed; `/api/webhooks/paystack` verifies the HMAC-SHA512 signature and idempotently marks donations success.
- Admin `/admin/giving` shows totals per fund + recent gifts with CSV export.
- `npx vitest run` and `npm run build` pass; dev smoke (page + webhook signature gate + success flip) verified. Live Paystack checkout pending the user's test keys.

**Next:** wire the user's Paystack **test** keys (`wrangler secret put PAYSTACK_SECRET_KEY`, `paystack_public_key`/`currency`/`giving_enabled` settings, webhook URL in dashboard) → live test-mode gift → then **Phase B2 (recurring)**.

---

## Open Questions (resolved defaults)
- Min/max GHS 1–100,000; presets 50/100/200/500 (hard-coded in money.ts / giving.astro — easy to change later).
- Webhook IP allowlist deferred (signature is sufficient).
