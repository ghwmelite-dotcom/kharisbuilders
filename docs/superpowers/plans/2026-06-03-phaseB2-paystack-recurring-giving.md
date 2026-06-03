# Phase B2: Paystack Recurring Giving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly/monthly/annual recurring giving on top of B1 — a One-time/Recurring toggle on `/giving`, Paystack plans+subscriptions, one donation row per auto-charge, and an admin subscriptions view with cancel — built/tested against mocks, needing real keys only for live verification.

**Architecture:** Reuse B1's signed webhook router, `donations` table, Paystack client, and money/reference helpers. New `plans` cache + `subscriptions` tables; `donations` gains `subscription_id`. The recurring initialize path ensures a Paystack plan (amount+interval), records a pending subscription carrying the fund, then subscribes. Webhooks correlate Paystack subscriptions to our fund by **(customer_email, plan_code)**. All new logic is dependency-injected (Paystack via injected `fetch`) and unit-tested; D1 access via the Miniflare harness.

**Tech Stack:** Astro 6 SSR, Cloudflare D1, zod v4, Vitest + Miniflare. Spec: `docs/superpowers/specs/2026-06-03-paystack-recurring-giving-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (branch `feat/phaseB2-recurring` off `main`).

> **Conventions (verified):** D1 enforces FKs under Miniflare; the test harness applies every `migrations/*.sql` sorted. `env` from `src/lib/runtime`; never import it in tests. Paystack client + webhook signature already exist from B1. Intervals are Paystack's `weekly` / `monthly` / `annually`. `getSetting(db,'currency')` defaults `'GHS'`. Gold buttons use `hover:bg-secondary` (gotcha). B1 `handlePaystackEvent` currently handles only `charge.success` (amount-checked, idempotent) — Task 8 rewrites it as a dispatcher.

---

## File Structure (created/modified)

```
migrations/0009_plans.sql                  # plans cache
migrations/0010_subscriptions.sql          # subscriptions
migrations/0011_donations_subscription.sql # ALTER donations ADD subscription_id

src/lib/db/plans.ts                         # getPlanByKey/insertPlan/getPlanByCode
src/lib/db/subscriptions.ts                 # pending/activate/status/lookup/list
src/lib/db/donations.ts                     # +subscription_id on create; +createRecurringDonation
src/lib/db/schemas.ts                        # +RecurringFields (type/interval) note (parsed in handler)
src/lib/paystack/client.ts                   # +createPlan +disableSubscription; plan on InitializeParams
src/lib/giving/reference.ts                  # +makeSubReference
src/lib/giving/ensure-plan.ts                # ensurePlan(db, {amount,interval,currency}, cfg)
src/lib/giving/initialize-handler.ts         # recurring branch
src/lib/giving/webhook-handler.ts            # dispatcher: charge.success / subscription.* / invoice.*

src/pages/giving.astro                        # one-time/recurring toggle + interval
src/pages/admin/subscriptions.astro           # list + cancel
src/pages/api/admin/subscriptions.ts          # gated cancel
src/layouts/AdminLayout.astro                 # +Recurring nav

tests/db/plans.test.ts
tests/db/subscriptions.test.ts
tests/db/donations-recurring.test.ts
tests/paystack/client-subscriptions.test.ts
tests/giving/ensure-plan.test.ts
tests/giving/initialize-recurring.test.ts
tests/giving/webhook-recurring.test.ts
```

---

## Task 1: migrations

**Files:** Create `migrations/0009_plans.sql`, `migrations/0010_subscriptions.sql`, `migrations/0011_donations_subscription.sql`.

- [ ] **Step 1: `migrations/0009_plans.sql`**

```sql
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  interval TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_key ON plans(amount, interval, currency);
```

- [ ] **Step 2: `migrations/0010_subscriptions.sql`**

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_ref TEXT NOT NULL UNIQUE,
  subscription_code TEXT UNIQUE,
  email_token TEXT,
  customer_code TEXT,
  customer_email TEXT NOT NULL,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  interval TEXT NOT NULL,
  fund_id INTEGER REFERENCES funds(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  next_payment_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subs_corr ON subscriptions(customer_email, plan_code);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);
```

- [ ] **Step 3: `migrations/0011_donations_subscription.sql`**

```sql
ALTER TABLE donations ADD COLUMN subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;
```

- [ ] **Step 4: Apply locally + verify**

```bash
npx wrangler d1 migrations apply kharisbuilders --local
npx wrangler d1 execute kharisbuilders --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('plans','subscriptions');"
npx wrangler d1 execute kharisbuilders --local --command "SELECT name FROM pragma_table_info('donations') WHERE name='subscription_id';"
```
Expected: both tables listed; `subscription_id` present.

- [ ] **Step 5: Commit** `feat: plans + subscriptions migrations + donations.subscription_id`.

---

## Task 2: plans data access (TDD)

**Files:** Create `src/lib/db/plans.ts`, `tests/db/plans.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/db/plans.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getPlanByKey, insertPlan, getPlanByCode } from '../../src/lib/db/plans';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

describe('plans data access', () => {
  it('inserts and looks up by business key + code', async () => {
    const id = await insertPlan(ctx.db, { plan_code: 'PLN_1', name: 'Kharis Monthly GHS 100', amount: 10000, interval: 'monthly', currency: 'GHS' });
    expect(id).toBeGreaterThan(0);
    const byKey = await getPlanByKey(ctx.db, 10000, 'monthly', 'GHS');
    expect(byKey?.plan_code).toBe('PLN_1');
    expect((await getPlanByCode(ctx.db, 'PLN_1'))?.id).toBe(id);
    expect(await getPlanByKey(ctx.db, 999, 'monthly', 'GHS')).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/db/plans.ts`**

```ts
export interface PlanRow {
  id: number;
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
}

export interface InsertPlanInput {
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
}

const COLS = 'id, plan_code, name, amount, interval, currency';

export async function insertPlan(db: D1Database, p: InsertPlanInput): Promise<number> {
  const r = await db
    .prepare('INSERT INTO plans (plan_code, name, amount, interval, currency) VALUES (?, ?, ?, ?, ?)')
    .bind(p.plan_code, p.name, p.amount, p.interval, p.currency)
    .run();
  return Number(r.meta.last_row_id);
}

export async function getPlanByKey(
  db: D1Database,
  amount: number,
  interval: string,
  currency: string,
): Promise<PlanRow | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM plans WHERE amount=? AND interval=? AND currency=?`)
    .bind(amount, interval, currency)
    .first<PlanRow>();
  return row ?? null;
}

export async function getPlanByCode(db: D1Database, code: string): Promise<PlanRow | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM plans WHERE plan_code=?`).bind(code).first<PlanRow>();
  return row ?? null;
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: plans data access with tests`.

---

## Task 3: subscriptions data access (TDD)

**Files:** Create `src/lib/db/subscriptions.ts`, `tests/db/subscriptions.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/db/subscriptions.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import {
  createPendingSubscription, activateSubscription, getSubscriptionByCode,
  getActiveSubscriptionForCharge, setSubscriptionStatus, listSubscriptions,
} from '../../src/lib/db/subscriptions';

let ctx: TestDb;
let fundId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(ctx.db, { name: 'General', slug: 'general', description: '', sort_order: 1, active: true }, 'a@x');
});
afterAll(async () => { await ctx.dispose(); });

describe('subscriptions data access', () => {
  it('creates pending, activates by (email, plan_code), and looks up', async () => {
    const id = await createPendingSubscription(ctx.db, {
      local_ref: 'kb_sub_1', customer_email: 'g@x.com', plan_id: null, plan_code: 'PLN_A',
      amount: 10000, interval: 'monthly', fund_id: fundId,
    });
    expect(id).toBeGreaterThan(0);

    await activateSubscription(ctx.db, {
      customerEmail: 'g@x.com', planCode: 'PLN_A', subscriptionCode: 'SUB_A',
      emailToken: 'tok', customerCode: 'CUS_A', nextPaymentAt: '2026-07-03 00:00:00',
    });
    const sub = await getSubscriptionByCode(ctx.db, 'SUB_A');
    expect(sub?.status).toBe('active');
    expect(sub?.email_token).toBe('tok');
    expect(sub?.fund_id).toBe(fundId);

    const forCharge = await getActiveSubscriptionForCharge(ctx.db, { customerEmail: 'g@x.com', planCode: 'PLN_A' });
    expect(forCharge?.id).toBe(id);
  });

  it('activate with no pending row inserts an unattributed active subscription', async () => {
    await activateSubscription(ctx.db, {
      customerEmail: 'h@x.com', planCode: 'PLN_Z', subscriptionCode: 'SUB_Z',
      emailToken: 't2', customerCode: 'CUS_Z', nextPaymentAt: null,
    });
    const sub = await getSubscriptionByCode(ctx.db, 'SUB_Z');
    expect(sub?.status).toBe('active');
    expect(sub?.fund_id).toBeNull();
  });

  it('activate is idempotent for the same code', async () => {
    await activateSubscription(ctx.db, { customerEmail: 'h@x.com', planCode: 'PLN_Z', subscriptionCode: 'SUB_Z', emailToken: 't2', customerCode: 'CUS_Z', nextPaymentAt: null });
    const { results } = await ctx.db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE subscription_code='SUB_Z'").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it('sets status and lists', async () => {
    await setSubscriptionStatus(ctx.db, 'SUB_A', 'cancelled');
    expect((await getSubscriptionByCode(ctx.db, 'SUB_A'))?.status).toBe('cancelled');
    const active = await listSubscriptions(ctx.db, { status: 'active' });
    expect(active.find((s) => s.subscription_code === 'SUB_A')).toBeUndefined();
    expect((await listSubscriptions(ctx.db, {})).length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/db/subscriptions.ts`**

```ts
export interface SubscriptionRow {
  id: number;
  local_ref: string;
  subscription_code: string | null;
  email_token: string | null;
  customer_code: string | null;
  customer_email: string;
  plan_id: number | null;
  plan_code: string;
  amount: number;
  interval: string;
  fund_id: number | null;
  status: string;
  next_payment_at: string | null;
}

const COLS =
  'id, local_ref, subscription_code, email_token, customer_code, customer_email, plan_id, plan_code, amount, interval, fund_id, status, next_payment_at';

export interface CreatePendingSubInput {
  local_ref: string;
  customer_email: string;
  plan_id: number | null;
  plan_code: string;
  amount: number;
  interval: string;
  fund_id?: number | null;
}

export async function createPendingSubscription(db: D1Database, s: CreatePendingSubInput): Promise<number> {
  const r = await db
    .prepare(
      `INSERT INTO subscriptions (local_ref, customer_email, plan_id, plan_code, amount, interval, fund_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .bind(s.local_ref, s.customer_email, s.plan_id ?? null, s.plan_code, s.amount, s.interval, s.fund_id ?? null)
    .run();
  return Number(r.meta.last_row_id);
}

export interface ActivateInput {
  customerEmail: string;
  planCode: string;
  subscriptionCode: string;
  emailToken?: string;
  customerCode?: string;
  nextPaymentAt?: string | null;
}

/**
 * Correlate a Paystack subscription to our pending row by (email, plan_code) and activate it.
 * If no pending row exists, insert an unattributed active subscription (fund_id null) so its
 * charges still record. Idempotent: a second call for the same subscription_code is a no-op.
 */
export async function activateSubscription(db: D1Database, a: ActivateInput): Promise<void> {
  const already = await db
    .prepare('SELECT id FROM subscriptions WHERE subscription_code=?')
    .bind(a.subscriptionCode)
    .first<{ id: number }>();
  if (already) return;

  const pending = await db
    .prepare(
      "SELECT id FROM subscriptions WHERE customer_email=? AND plan_code=? AND status='pending' AND subscription_code IS NULL ORDER BY id DESC LIMIT 1",
    )
    .bind(a.customerEmail, a.planCode)
    .first<{ id: number }>();

  if (pending) {
    await db
      .prepare(
        `UPDATE subscriptions SET subscription_code=?, email_token=?, customer_code=?, next_payment_at=?,
          status='active', updated_at=datetime('now') WHERE id=?`,
      )
      .bind(a.subscriptionCode, a.emailToken ?? null, a.customerCode ?? null, a.nextPaymentAt ?? null, pending.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO subscriptions (local_ref, subscription_code, email_token, customer_code, customer_email, plan_code, amount, interval, fund_id, status, next_payment_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, '', NULL, 'active', ?)`,
    )
    .bind(
      `auto_${a.subscriptionCode}`,
      a.subscriptionCode,
      a.emailToken ?? null,
      a.customerCode ?? null,
      a.customerEmail,
      a.planCode,
      a.nextPaymentAt ?? null,
    )
    .run();
}

export async function getSubscriptionByCode(db: D1Database, code: string): Promise<SubscriptionRow | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM subscriptions WHERE subscription_code=?`).bind(code).first<SubscriptionRow>();
  return row ?? null;
}

export async function getActiveSubscriptionForCharge(
  db: D1Database,
  q: { customerEmail: string; planCode: string },
): Promise<SubscriptionRow | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM subscriptions WHERE customer_email=? AND plan_code=? AND status='active' ORDER BY id DESC LIMIT 1`)
    .bind(q.customerEmail, q.planCode)
    .first<SubscriptionRow>();
  return row ?? null;
}

export async function setSubscriptionStatus(db: D1Database, code: string, status: string): Promise<void> {
  await db
    .prepare("UPDATE subscriptions SET status=?, updated_at=datetime('now') WHERE subscription_code=?")
    .bind(status, code)
    .run();
}

export async function setNextPayment(db: D1Database, code: string, at: string): Promise<void> {
  await db
    .prepare("UPDATE subscriptions SET next_payment_at=?, updated_at=datetime('now') WHERE subscription_code=?")
    .bind(at, code)
    .run();
}

export async function listSubscriptions(db: D1Database, opts: { status?: string }): Promise<SubscriptionRow[]> {
  if (opts.status) {
    const { results } = await db
      .prepare(`SELECT ${COLS} FROM subscriptions WHERE status=? ORDER BY id DESC`)
      .bind(opts.status)
      .all<SubscriptionRow>();
    return results;
  }
  const { results } = await db.prepare(`SELECT ${COLS} FROM subscriptions ORDER BY id DESC`).all<SubscriptionRow>();
  return results;
}
```

> Note: the auto-insert binds `amount` `0` and `interval` `''` literally in SQL (we don't know them from a bare event); fund stays null. These unattributed rows are a safety net, surfaced in admin for manual follow-up.

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: subscriptions data access (pending/activate/correlate/list) with tests`.

---

## Task 4: donations — subscription_id + recurring insert (TDD)

**Files:** Modify `src/lib/db/donations.ts`; create `tests/db/donations-recurring.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/db/donations-recurring.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { createPendingDonation, createRecurringDonation, getDonationByReference, donationTotals } from '../../src/lib/db/donations';

let ctx: TestDb;
let fundId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(ctx.db, { name: 'G', slug: 'g', description: '', sort_order: 1, active: true }, 'a@x');
});
afterAll(async () => { await ctx.dispose(); });

describe('recurring donations', () => {
  it('createPendingDonation accepts subscription_id', async () => {
    await createPendingDonation(ctx.db, { reference: 'kb_first', email: 'g@x.com', name: '', amount: 10000, currency: 'GHS', fund_id: fundId, type: 'recurring', metadata: '{}', subscription_id: 1 });
    expect((await getDonationByReference(ctx.db, 'kb_first'))?.subscription_id).toBe(1);
  });

  it('createRecurringDonation inserts a success row, idempotent on reference', async () => {
    await createRecurringDonation(ctx.db, { reference: 'kb_cycle1', email: 'g@x.com', name: null, amount: 10000, currency: 'GHS', fund_id: fundId, subscription_id: 1, channel: 'card', paidAt: '2026-07-03 10:00:00' });
    const d = await getDonationByReference(ctx.db, 'kb_cycle1');
    expect(d?.status).toBe('success');
    expect(d?.type).toBe('recurring');
    expect(d?.subscription_id).toBe(1);
    // idempotent: second call with same reference does not duplicate or change
    await createRecurringDonation(ctx.db, { reference: 'kb_cycle1', email: 'g@x.com', name: null, amount: 999, currency: 'GHS', fund_id: fundId, subscription_id: 1, channel: 'card', paidAt: 'x' });
    expect((await getDonationByReference(ctx.db, 'kb_cycle1'))?.amount).toBe(10000);
    const totals = await donationTotals(ctx.db);
    expect(totals.total).toBe(10000); // only the one successful cycle row counts
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Modify `src/lib/db/donations.ts`**

Add `subscription_id` to the `DonationRow` interface and the `COLS` list:
```ts
// in interface DonationRow add:
  subscription_id: number | null;
// COLS becomes:
const COLS =
  'id, reference, email, name, amount, currency, fund_id, type, status, channel, paystack_status, paid_at, metadata, subscription_id, created_at';
```
Add `subscription_id?` to `CreatePendingInput` and include it in the insert:
```ts
export interface CreatePendingInput {
  reference: string;
  email: string;
  name: string;
  amount: number;
  currency: string;
  fund_id?: number;
  type: string;
  metadata: string;
  subscription_id?: number | null;
}

export async function createPendingDonation(db: D1Database, d: CreatePendingInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO donations (reference, email, name, amount, currency, fund_id, type, status, metadata, subscription_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .bind(d.reference, d.email, d.name || null, d.amount, d.currency, d.fund_id ?? null, d.type, d.metadata, d.subscription_id ?? null)
    .run();
}
```
Append `createRecurringDonation` (idempotent success insert for an auto-charge):
```ts
export interface RecurringDonationInput {
  reference: string;
  email: string;
  name: string | null;
  amount: number;
  currency: string;
  fund_id: number | null;
  subscription_id: number | null;
  channel?: string;
  paidAt?: string;
}

export async function createRecurringDonation(db: D1Database, d: RecurringDonationInput): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO donations (reference, email, name, amount, currency, fund_id, type, status, channel, paystack_status, paid_at, subscription_id)
       VALUES (?, ?, ?, ?, ?, ?, 'recurring', 'success', ?, 'success', ?, ?)`,
    )
    .bind(d.reference, d.email, d.name || null, d.amount, d.currency, d.fund_id ?? null, d.channel ?? null, d.paidAt ?? null, d.subscription_id ?? null)
    .run();
}
```

- [ ] **Step 4: Run → pass.** (Re-run `tests/db/donations.test.ts` too — `subscription_id` now in COLS but existing rows return null; assertions unaffected.)

- [ ] **Step 5: Commit** `feat: donations subscription_id + createRecurringDonation with tests`.

---

## Task 5: Paystack client — plans + subscription disable (TDD)

**Files:** Modify `src/lib/paystack/client.ts`; create `tests/paystack/client-subscriptions.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/paystack/client-subscriptions.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { createPlan, disableSubscription, initializeTransaction } from '../../src/lib/paystack/client';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

describe('createPlan', () => {
  it('posts plan details and returns the plan code', async () => {
    let body: any = null;
    const fetchFn = (async (_url: string, init: RequestInit) => { body = JSON.parse(init.body as string); return json({ status: true, data: { plan_code: 'PLN_x' } }); }) as unknown as typeof fetch;
    const res = await createPlan({ name: 'Kharis Monthly GHS 100', amount: 10000, interval: 'monthly', currency: 'GHS' }, { secret: 'sk', fetchFn });
    expect(res).toEqual({ ok: true, planCode: 'PLN_x' });
    expect(body).toMatchObject({ name: 'Kharis Monthly GHS 100', amount: 10000, interval: 'monthly', currency: 'GHS' });
  });
  it('returns ok:false on error', async () => {
    const fetchFn = (async () => json({ status: false, message: 'bad' }, 400)) as unknown as typeof fetch;
    expect((await createPlan({ name: 'n', amount: 1, interval: 'monthly', currency: 'GHS' }, { secret: 'x', fetchFn })).ok).toBe(false);
  });
});

describe('disableSubscription', () => {
  it('posts code + token', async () => {
    let body: any = null;
    const fetchFn = (async (url: string, init: RequestInit) => { body = JSON.parse(init.body as string); expect(url).toBe('https://api.paystack.co/subscription/disable'); return json({ status: true }); }) as unknown as typeof fetch;
    const res = await disableSubscription({ code: 'SUB_A', token: 'tok' }, { secret: 'sk', fetchFn });
    expect(res.ok).toBe(true);
    expect(body).toEqual({ code: 'SUB_A', token: 'tok' });
  });
});

describe('initializeTransaction with plan', () => {
  it('sends plan and omits amount', async () => {
    let body: any = null;
    const fetchFn = (async (_url: string, init: RequestInit) => { body = JSON.parse(init.body as string); return json({ status: true, data: { authorization_url: 'u', access_code: 'a', reference: 'r' } }); }) as unknown as typeof fetch;
    await initializeTransaction({ email: 'g@x.com', currency: 'GHS', reference: 'r', callbackUrl: 'c', metadata: {}, plan: 'PLN_x' }, { secret: 'sk', fetchFn });
    expect(body.plan).toBe('PLN_x');
    expect('amount' in body).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Modify `src/lib/paystack/client.ts`**

Make `amount` optional and add `plan` on `InitializeParams`, and only include each in the body when present:
```ts
export interface InitializeParams {
  email: string;
  amount?: number; // minor units; omit when subscribing via plan
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  plan?: string; // Paystack plan_code for subscriptions
}
```
In `initializeTransaction`, replace the `body: JSON.stringify({...})` object with a built payload:
```ts
    const payload: Record<string, unknown> = {
      email: params.email,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    };
    if (params.plan) payload.plan = params.plan;
    else if (typeof params.amount === 'number') payload.amount = params.amount;
    const res = await doFetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
```
Append two functions:
```ts
export type CreatePlanResult = { ok: true; planCode: string } | { ok: false; error: string };

export async function createPlan(
  p: { name: string; amount: number; interval: string; currency: string },
  cfg: PaystackConfig,
): Promise<CreatePlanResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${API}/plan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: p.name, amount: p.amount, interval: p.interval, currency: p.currency }),
    });
    const j = (await res.json()) as { status?: boolean; data?: { plan_code?: string }; message?: string };
    if (!res.ok || !j.status || !j.data?.plan_code) return { ok: false, error: j.message ?? `plan failed (${res.status})` };
    return { ok: true, planCode: j.data.plan_code };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export type DisableResult = { ok: true } | { ok: false; error: string };

export async function disableSubscription(
  s: { code: string; token: string },
  cfg: PaystackConfig,
): Promise<DisableResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${API}/subscription/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: s.code, token: s.token }),
    });
    const j = (await res.json()) as { status?: boolean; message?: string };
    if (!res.ok || !j.status) return { ok: false, error: j.message ?? `disable failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}
```

- [ ] **Step 4: Run → pass.** (Re-run `tests/paystack/client.test.ts` — initialize with `amount` still sends `amount` since `plan` is absent.)

- [ ] **Step 5: Commit** `feat: Paystack createPlan + disableSubscription + plan on initialize, with tests`.

---

## Task 6: reference helper + ensure-plan (TDD)

**Files:** Modify `src/lib/giving/reference.ts`; create `src/lib/giving/ensure-plan.ts`, `tests/giving/ensure-plan.test.ts`.

- [ ] **Step 1: Add `makeSubReference` to `src/lib/giving/reference.ts`**

```ts
/** Local correlation id for a pending subscription. */
export function makeSubReference(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `kb_sub_${rand}`;
}
```

- [ ] **Step 2: Write the failing test** (`tests/giving/ensure-plan.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getPlanByKey } from '../../src/lib/db/plans';
import { ensurePlan } from '../../src/lib/giving/ensure-plan';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

function planFetch() {
  return vi.fn(async () => new Response(JSON.stringify({ status: true, data: { plan_code: 'PLN_new' } }), { status: 200 })) as unknown as typeof fetch & { mock: any };
}

describe('ensurePlan', () => {
  it('creates a Paystack plan on cache miss, then caches it', async () => {
    const fetchFn = planFetch();
    const res = await ensurePlan(ctx.db, { amount: 10000, interval: 'monthly', currency: 'GHS' }, { secret: 'sk', fetchFn });
    expect(res.ok && res.planCode).toBe('PLN_new');
    expect((fetchFn as any).mock.calls.length).toBe(1);
    expect((await getPlanByKey(ctx.db, 10000, 'monthly', 'GHS'))?.plan_code).toBe('PLN_new');
  });

  it('returns the cached plan without calling Paystack on a hit', async () => {
    const fetchFn = planFetch();
    const res = await ensurePlan(ctx.db, { amount: 10000, interval: 'monthly', currency: 'GHS' }, { secret: 'sk', fetchFn });
    expect(res.ok && res.planCode).toBe('PLN_new');
    expect((fetchFn as any).mock.calls.length).toBe(0); // cache hit, no network
  });
});
```

- [ ] **Step 3: Run → fail.**

- [ ] **Step 4: Implement `src/lib/giving/ensure-plan.ts`**

```ts
import { getPlanByKey, insertPlan } from '../db/plans';
import { createPlan } from '../paystack/client';
import { fromMinorUnits } from './money';

export type EnsurePlanResult = { ok: true; planCode: string; planId: number } | { ok: false; error: string };

const INTERVAL_LABEL: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', annually: 'Annual' };

/** Return a Paystack plan code for (amount, interval, currency), creating + caching it on a miss. */
export async function ensurePlan(
  db: D1Database,
  key: { amount: number; interval: string; currency: string },
  cfg: { secret: string; fetchFn?: typeof fetch },
): Promise<EnsurePlanResult> {
  const cached = await getPlanByKey(db, key.amount, key.interval, key.currency);
  if (cached) return { ok: true, planCode: cached.plan_code, planId: cached.id };

  const label = INTERVAL_LABEL[key.interval] ?? key.interval;
  const name = `Kharis ${label} ${key.currency} ${fromMinorUnits(key.amount).toFixed(2)}`;
  const created = await createPlan({ name, amount: key.amount, interval: key.interval, currency: key.currency }, cfg);
  if (!created.ok) return { ok: false, error: created.error };

  const planId = await insertPlan(db, {
    plan_code: created.planCode,
    name,
    amount: key.amount,
    interval: key.interval,
    currency: key.currency,
  });
  return { ok: true, planCode: created.planCode, planId };
}
```

- [ ] **Step 5: Run → pass.**

- [ ] **Step 6: Commit** `feat: makeSubReference + ensurePlan (Paystack plan cache) with tests`.

---

## Task 7: initialize-handler — recurring branch (TDD)

**Files:** Modify `src/lib/giving/initialize-handler.ts`; create `tests/giving/initialize-recurring.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/giving/initialize-recurring.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { listSubscriptions } from '../../src/lib/db/subscriptions';
import { listDonations } from '../../src/lib/db/donations';
import { getPlanByKey } from '../../src/lib/db/plans';
import { handleInitialize } from '../../src/lib/giving/initialize-handler';

let ctx: TestDb;
let fundId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(ctx.db, { name: 'General', slug: 'general', description: '', sort_order: 1, active: true }, 'a@x');
});
afterAll(async () => { await ctx.dispose(); });

function form(f: Record<string, string>): FormData { const fd = new FormData(); for (const [k, v] of Object.entries(f)) fd.append(k, v); return fd; }

// siteverify -> ok; /plan -> plan code; /transaction/initialize -> auth url
const okFetch = (async (url: string) => {
  if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: true }), { status: 200 });
  if (String(url).includes('/plan')) return new Response(JSON.stringify({ status: true, data: { plan_code: 'PLN_m' } }), { status: 200 });
  return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://pay/checkout', access_code: 'a', reference: 'r' } }), { status: 200 });
}) as unknown as typeof fetch;

const env = { DB: undefined as unknown as D1Database, PAYSTACK_SECRET_KEY: 'sk', TURNSTILE_SECRET_KEY: 'ts' };

describe('handleInitialize (recurring)', () => {
  it('rejects an invalid interval', async () => {
    const res = await handleInitialize({ ...env, DB: ctx.db }, form({ type: 'recurring', interval: 'daily', email: 'g@x.com', amount: '100', fund_id: String(fundId), 'cf-turnstile-response': 'x' }), undefined, { origin: 'https://s', fetchFn: okFetch });
    expect(res.redirect).toContain('error=');
  });

  it('ensures a plan, records a pending subscription + pending donation, and redirects', async () => {
    const res = await handleInitialize({ ...env, DB: ctx.db }, form({ type: 'recurring', interval: 'monthly', email: 'g@x.com', name: 'Gift', amount: '100', fund_id: String(fundId), 'cf-turnstile-response': 'x' }), '1.1.1.1', { origin: 'https://s', fetchFn: okFetch });
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('https://pay/checkout');
    expect((await getPlanByKey(ctx.db, 10000, 'monthly', 'GHS'))?.plan_code).toBe('PLN_m');
    const subs = await listSubscriptions(ctx.db, {});
    const sub = subs.find((s) => s.customer_email === 'g@x.com' && s.plan_code === 'PLN_m');
    expect(sub?.status).toBe('pending');
    expect(sub?.fund_id).toBe(fundId);
    const don = (await listDonations(ctx.db, { limit: 10, offset: 0 })).find((d) => d.type === 'recurring' && d.email === 'g@x.com');
    expect(don?.status).toBe('pending');
    expect(don?.subscription_id).toBe(sub?.id);
  });

  it('still handles one-time gifts (regression)', async () => {
    const res = await handleInitialize({ ...env, DB: ctx.db }, form({ type: 'one_time', email: 'o@x.com', amount: '50', fund_id: String(fundId), 'cf-turnstile-response': 'x' }), undefined, { origin: 'https://s', fetchFn: okFetch });
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('https://pay/checkout');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Modify `src/lib/giving/initialize-handler.ts`**

Add imports:
```ts
import { makeReference, makeSubReference } from './reference';
import { ensurePlan } from './ensure-plan';
import { createPendingSubscription } from '../db/subscriptions';
```
(Replace the existing `import { makeReference } from './reference';`.)

Add an interval allowlist near the top:
```ts
const INTERVALS = ['weekly', 'monthly', 'annually'];
```
In `handleInitialize`, after the Turnstile check and `const currency = ...`, insert the recurring branch BEFORE the existing one-time block:
```ts
  const type = String(form.get('type') ?? 'one_time');

  if (type === 'recurring') {
    const interval = String(form.get('interval') ?? '');
    if (!INTERVALS.includes(interval)) return back('interval');

    const plan = await ensurePlan(env.DB, { amount: amount.minor, interval, currency }, { secret: env.PAYSTACK_SECRET_KEY ?? '', fetchFn: doFetch });
    if (!plan.ok) return back('init');

    const localRef = makeSubReference();
    const subId = await createPendingSubscription(env.DB, {
      local_ref: localRef,
      customer_email: parsed.data.email,
      plan_id: plan.planId,
      plan_code: plan.planCode,
      amount: amount.minor,
      interval,
      fund_id: parsed.data.fund_id,
    });

    const reference = makeReference();
    const metadata = { fund_id: parsed.data.fund_id ?? null, donor_name: parsed.data.name || null, recurring: true };
    await createPendingDonation(env.DB, {
      reference,
      email: parsed.data.email,
      name: parsed.data.name ?? '',
      amount: amount.minor,
      currency,
      fund_id: parsed.data.fund_id,
      type: 'recurring',
      metadata: JSON.stringify(metadata),
      subscription_id: subId,
    });

    const init = await initializeTransaction(
      { email: parsed.data.email, currency, reference, callbackUrl: `${deps.origin}/giving/callback`, metadata, plan: plan.planCode },
      { secret: env.PAYSTACK_SECRET_KEY ?? '', fetchFn: doFetch },
    );
    if (!init.ok) return back('init');
    return { status: 303, redirect: init.authorizationUrl };
  }

  // --- one-time (existing) ---
```
Leave the existing one-time code (reference/metadata/createPendingDonation/initializeTransaction) exactly as it is below this branch.

- [ ] **Step 4: Run → pass.** (Also re-run `tests/giving/initialize-handler.test.ts` — one-time path unchanged.)

- [ ] **Step 5: Commit** `feat: recurring initialize branch (ensure plan, pending sub + donation) with tests`.

---

## Task 8: webhook dispatcher — subscription + recurring events (TDD)

**Files:** Modify `src/lib/giving/webhook-handler.ts`; create `tests/giving/webhook-recurring.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/giving/webhook-recurring.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { createPendingSubscription, getSubscriptionByCode } from '../../src/lib/db/subscriptions';
import { createPendingDonation, getDonationByReference } from '../../src/lib/db/donations';
import { handlePaystackEvent } from '../../src/lib/giving/webhook-handler';

let ctx: TestDb;
let fundId: number;
let subId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(ctx.db, { name: 'G', slug: 'g', description: '', sort_order: 1, active: true }, 'a@x');
  subId = await createPendingSubscription(ctx.db, { local_ref: 'kb_sub_1', customer_email: 'g@x.com', plan_id: null, plan_code: 'PLN_A', amount: 10000, interval: 'monthly', fund_id: fundId });
  // first-charge pending donation tied to the subscription
  await createPendingDonation(ctx.db, { reference: 'kb_first', email: 'g@x.com', name: '', amount: 10000, currency: 'GHS', fund_id: fundId, type: 'recurring', metadata: '{}', subscription_id: subId });
});
afterAll(async () => { await ctx.dispose(); });

describe('recurring webhooks', () => {
  it('subscription.create activates the pending subscription', async () => {
    await handlePaystackEvent(ctx.db, { event: 'subscription.create', data: { subscription_code: 'SUB_A', email_token: 'tok', next_payment_date: '2026-07-03 00:00:00', customer: { email: 'g@x.com', customer_code: 'CUS_A' }, plan: { plan_code: 'PLN_A' } } });
    const sub = await getSubscriptionByCode(ctx.db, 'SUB_A');
    expect(sub?.status).toBe('active');
    expect(sub?.fund_id).toBe(fundId);
  });

  it('first charge.success marks the pending donation (by reference)', async () => {
    await handlePaystackEvent(ctx.db, { event: 'charge.success', data: { reference: 'kb_first', amount: 10000, channel: 'card', status: 'success', paid_at: '2026-06-03 10:00:00' } });
    expect((await getDonationByReference(ctx.db, 'kb_first'))?.status).toBe('success');
  });

  it('a cycle charge.success (new reference) records a recurring donation with the sub fund', async () => {
    await handlePaystackEvent(ctx.db, { event: 'charge.success', data: { reference: 'kb_cycle1', amount: 10000, currency: 'GHS', channel: 'card', status: 'success', paid_at: '2026-07-03 10:00:00', customer: { email: 'g@x.com' }, plan: { plan_code: 'PLN_A' } } });
    const d = await getDonationByReference(ctx.db, 'kb_cycle1');
    expect(d?.type).toBe('recurring');
    expect(d?.status).toBe('success');
    expect(d?.fund_id).toBe(fundId);
    expect(d?.subscription_id).toBe(subId);
  });

  it('duplicate cycle charge is idempotent', async () => {
    await handlePaystackEvent(ctx.db, { event: 'charge.success', data: { reference: 'kb_cycle1', amount: 1, channel: 'card', status: 'success', customer: { email: 'g@x.com' }, plan: { plan_code: 'PLN_A' } } });
    expect((await getDonationByReference(ctx.db, 'kb_cycle1'))?.amount).toBe(10000); // unchanged
  });

  it('invoice.payment_failed flags the subscription; disable cancels it', async () => {
    await handlePaystackEvent(ctx.db, { event: 'invoice.payment_failed', data: { subscription: { subscription_code: 'SUB_A' } } });
    expect((await getSubscriptionByCode(ctx.db, 'SUB_A'))?.status).toBe('attention');
    await handlePaystackEvent(ctx.db, { event: 'subscription.disable', data: { subscription_code: 'SUB_A' } });
    expect((await getSubscriptionByCode(ctx.db, 'SUB_A'))?.status).toBe('cancelled');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Rewrite `src/lib/giving/webhook-handler.ts`** as a dispatcher

```ts
import { getDonationByReference, markDonationSuccess, createRecurringDonation } from '../db/donations';
import {
  activateSubscription,
  getActiveSubscriptionForCharge,
  setSubscriptionStatus,
} from '../db/subscriptions';

export interface PaystackEvent {
  event: string;
  data?: {
    reference?: string;
    channel?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    email_token?: string;
    subscription_code?: string;
    next_payment_date?: string;
    customer?: { email?: string; customer_code?: string };
    plan?: { plan_code?: string };
    subscription?: { subscription_code?: string };
  };
}

async function handleChargeSuccess(db: D1Database, data: NonNullable<PaystackEvent['data']>): Promise<void> {
  if (!data.reference) return;
  const existing = await getDonationByReference(db, data.reference);
  if (existing) {
    // first charge (or already recorded) — amount-checked, idempotent (B1 behaviour)
    if (typeof data.amount === 'number' && data.amount !== existing.amount) return;
    await markDonationSuccess(db, data.reference, { channel: data.channel, paystackStatus: data.status, paidAt: data.paid_at });
    return;
  }
  // automatic cycle charge: correlate the subscription by (email, plan_code)
  const email = data.customer?.email;
  const planCode = data.plan?.plan_code;
  if (!email) return; // cannot attribute without an email — drop (not a giving charge we initiated)
  const sub = planCode ? await getActiveSubscriptionForCharge(db, { customerEmail: email, planCode }) : null;
  await createRecurringDonation(db, {
    reference: data.reference,
    email,
    name: null,
    amount: data.amount ?? sub?.amount ?? 0,
    currency: data.currency ?? 'GHS',
    fund_id: sub?.fund_id ?? null,
    subscription_id: sub?.id ?? null,
    channel: data.channel,
    paidAt: data.paid_at,
  });
}

async function handleSubscriptionCreate(db: D1Database, data: NonNullable<PaystackEvent['data']>): Promise<void> {
  const email = data.customer?.email;
  const planCode = data.plan?.plan_code;
  if (!email || !planCode || !data.subscription_code) return;
  await activateSubscription(db, {
    customerEmail: email,
    planCode,
    subscriptionCode: data.subscription_code,
    emailToken: data.email_token,
    customerCode: data.customer?.customer_code,
    nextPaymentAt: data.next_payment_date,
  });
}

/** Dispatch a verified Paystack webhook event. Idempotent; unknown events are no-ops. */
export async function handlePaystackEvent(db: D1Database, event: PaystackEvent): Promise<void> {
  const data = event.data;
  if (!data) return;
  switch (event.event) {
    case 'charge.success':
      return handleChargeSuccess(db, data);
    case 'subscription.create':
      return handleSubscriptionCreate(db, data);
    case 'invoice.payment_failed':
      if (data.subscription?.subscription_code) await setSubscriptionStatus(db, data.subscription.subscription_code, 'attention');
      return;
    case 'subscription.disable':
    case 'subscription.not_renew':
      if (data.subscription_code) await setSubscriptionStatus(db, data.subscription_code, 'cancelled');
      return;
    default:
      return;
  }
}
```

- [ ] **Step 4: Run → pass.** Re-run `tests/giving/webhook-handler.test.ts` (B1) — first-charge + amount-mismatch + unknown-event cases still pass (the charge.success path preserves B1 behaviour for donations that exist; the B1 "unknown reference" no-op test sends a charge with a reference that has no donation AND no customer.email, so `handleChargeSuccess` returns at the `if (!email) return` guard — still a no-op).

- [ ] **Step 5: Commit** `feat: webhook dispatcher for subscription + recurring charge events with tests`.

---

## Task 9: giving page — recurring toggle + interval

**Files:** Modify `src/pages/giving.astro`.

- [ ] **Step 1: Add the toggle + interval to the form** (inside the `<form>`, before the fund select)

```astro
          <div>
            <span class="font-label-sm uppercase tracking-widest text-heritage-gold block mb-3">Gift type</span>
            <div class="grid grid-cols-2 gap-3">
              <label class="give-type flex items-center justify-center gap-2 border border-champagne py-3 font-body text-body-md text-primary cursor-pointer has-[:checked]:border-heritage-gold has-[:checked]:bg-surface-container-high">
                <input type="radio" name="type" value="one_time" checked class="sr-only" /> One-time
              </label>
              <label class="give-type flex items-center justify-center gap-2 border border-champagne py-3 font-body text-body-md text-primary cursor-pointer has-[:checked]:border-heritage-gold has-[:checked]:bg-surface-container-high">
                <input type="radio" name="type" value="recurring" class="sr-only" /> Recurring
              </label>
            </div>
          </div>

          <div id="interval-row" class="hidden">
            <label for="g-interval" class="font-label-sm uppercase tracking-widest text-heritage-gold block mb-3">How often</label>
            <select id="g-interval" name="interval" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="annually">Annually</option>
            </select>
            <p class="font-body text-body-sm text-stone-gray mt-2">You'll be charged automatically each period until you cancel. Paystack emails you a link to manage or stop it anytime.</p>
          </div>
```

- [ ] **Step 2: Reveal the interval when Recurring is selected** — extend the existing inline `<script>` (append inside it)

```js
    const intervalRow = document.getElementById('interval-row');
    document.querySelectorAll('input[name="type"]').forEach((r) => {
      r.addEventListener('change', () => {
        const recurring = document.querySelector('input[name="type"]:checked')?.value === 'recurring';
        if (intervalRow) intervalRow.classList.toggle('hidden', !recurring);
      });
    });
```

- [ ] **Step 3: Add the new error key** — in the `errors` map in the frontmatter, add:
```ts
  interval: 'Please choose how often you would like to give.',
```

- [ ] **Step 4: Build** (`npm run build`) → succeeds.

- [ ] **Step 5: Commit** `feat: one-time/recurring toggle + interval on giving page`.

---

## Task 10: admin subscriptions — list + cancel

**Files:** Create `src/pages/admin/subscriptions.astro`, `src/pages/api/admin/subscriptions.ts`; modify `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: Add nav item in `src/layouts/AdminLayout.astro`** (after the `giving` entry)

```astro
  { label: 'Recurring', href: '/admin/subscriptions', key: 'subscriptions' },
```

- [ ] **Step 2: Implement `src/pages/api/admin/subscriptions.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { getSubscriptionByCode, setSubscriptionStatus } from '../../../lib/db/subscriptions';
import { disableSubscription } from '../../../lib/paystack/client';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const code = String(form.get('code') ?? '');
  if (String(form.get('_action')) === 'cancel' && code) {
    const sub = await getSubscriptionByCode(env.DB, code).catch(() => null);
    if (sub?.subscription_code && sub.email_token) {
      const res = await disableSubscription({ code: sub.subscription_code, token: sub.email_token }, { secret: env.PAYSTACK_SECRET_KEY ?? '' });
      if (res.ok) await setSubscriptionStatus(env.DB, code, 'cancelled');
    }
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/subscriptions' } });
};
```

- [ ] **Step 3: Implement `src/pages/admin/subscriptions.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listSubscriptions } from '../../lib/db/subscriptions';
import { formatAmount } from '../../lib/giving/money';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const subs = await listSubscriptions(env.DB, {}).catch(() => []);
const intervalLabel: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', annually: 'Annual' };
---
<AdminLayout title="Recurring giving" email={email} active="subscriptions">
  <table class="w-full text-sm">
    <thead>
      <tr class="text-left text-on-surface-variant border-b border-champagne">
        <th class="py-2">Giver</th><th>Amount</th><th>Every</th><th>Status</th><th>Next</th><th class="text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {
        subs.map((s) => (
          <tr class="border-b border-champagne/50">
            <td class="py-3">{s.customer_email}</td>
            <td>{formatAmount(s.amount)}</td>
            <td>{intervalLabel[s.interval] ?? s.interval}</td>
            <td>{s.status}</td>
            <td>{s.next_payment_at ?? '—'}</td>
            <td class="text-right">
              {s.status === 'active' && s.subscription_code && (
                <form method="POST" action="/api/admin/subscriptions" class="inline" onsubmit="return confirm('Cancel this recurring gift on Paystack?')">
                  <input type="hidden" name="_action" value="cancel" />
                  <input type="hidden" name="code" value={s.subscription_code} />
                  <button class="text-accent-deep text-xs uppercase tracking-wider">Cancel</button>
                </form>
              )}
            </td>
          </tr>
        ))
      }
    </tbody>
  </table>
  {subs.length === 0 && <p class="text-on-surface-variant mt-4">No recurring gifts yet.</p>}
</AdminLayout>
```

- [ ] **Step 4: Build** → succeeds.

- [ ] **Step 5: Commit** `feat: admin recurring subscriptions list + cancel + nav`.

---

## Task 11: full gate + dev verification

- [ ] **Step 1: Full unit suite** (`npx vitest run`) — prior 104 + new (~22) pass.

- [ ] **Step 2: Build** (`npm run build`).

- [ ] **Step 3: Dev smoke** (`npm run dev`, with `giving_enabled=true`, `PAYSTACK_SECRET_KEY` placeholder in `.dev.vars` from B1)

```bash
# recurring toggle + interval present
curl -s http://localhost:4321/giving | grep -c 'name="type"'           # 2 (radios)
curl -s http://localhost:4321/giving | grep -c 'name="interval"'        # 1

# subscription.create activates a sub, then a cycle charge records a donation — via signed webhook:
npx wrangler d1 execute kharisbuilders --local --command "INSERT INTO funds (name,slug,sort_order,active) VALUES ('Dev Fund','dev-fund',9,1);"
# create a pending subscription (simulating initialize)
npx wrangler d1 execute kharisbuilders --local --command "INSERT INTO subscriptions (local_ref,customer_email,plan_code,amount,interval,fund_id,status) SELECT 'kb_sub_dev','d@x.com','PLN_DEV',10000,'monthly',id,'pending' FROM funds WHERE slug='dev-fund';"
# sign + POST subscription.create then a cycle charge (node, using the dev secret)
node -e "const c=require('crypto');const s=process.env.PAYSTACK_SECRET_KEY||'sk_test_devplaceholder';
const post=async(b)=>{const sig=c.createHmac('sha512',s).update(b).digest('hex');const r=await fetch('http://localhost:4321/api/webhooks/paystack',{method:'POST',headers:{'content-type':'application/json','x-paystack-signature':sig},body:b});console.log(r.status);};
(async()=>{
  await post(JSON.stringify({event:'subscription.create',data:{subscription_code:'SUB_DEV',email_token:'tok',next_payment_date:'2026-08-01 00:00:00',customer:{email:'d@x.com',customer_code:'CUS_DEV'},plan:{plan_code:'PLN_DEV'}}}));
  await post(JSON.stringify({event:'charge.success',data:{reference:'kb_dev_cycle',amount:10000,currency:'GHS',channel:'card',status:'success',paid_at:'2026-08-01 10:00:00',customer:{email:'d@x.com'},plan:{plan_code:'PLN_DEV'}}}));
})();"
npx wrangler d1 execute kharisbuilders --local --command "SELECT status,subscription_code FROM subscriptions WHERE subscription_code='SUB_DEV';"   # active
npx wrangler d1 execute kharisbuilders --local --command "SELECT type,status,fund_id FROM donations WHERE reference='kb_dev_cycle';"             # recurring/success/<dev fund id>
curl -s -o /dev/null -w "admin subs: %{http_code}\n" http://localhost:4321/admin/subscriptions   # 200
```
Expected: toggle + interval render; subscription.create flips the pending sub to `active`; the cycle charge writes a `recurring`/`success` donation designated to the sub's fund; admin page renders. Clean up the dev rows afterward.

- [ ] **Step 4: Clean tree** (`git status --short`).

---

## Phase B2 Done — Definition of Done
- `plans` + `subscriptions` tables exist; `donations.subscription_id` links cycle charges.
- `/giving` offers One-time/Recurring with Monthly/Weekly/Annual; recurring ensures a Paystack plan and subscribes.
- Webhooks activate subscriptions (correlated by email+plan), record one donation per cycle (with the sub's fund), flag failures, and cancel on disable — all idempotent and amount-safe.
- Admin `/admin/subscriptions` lists recurring gifts and cancels via Paystack; recurring charges roll into `/admin/giving` totals.
- `npx vitest run` and `npm run build` pass; dev smoke (toggle + subscription.create + cycle charge + admin) verified. Live recurring pending the user's Paystack keys (same endpoint/keys as B1).

**Next:** with B1+B2 deployed, the giving system is complete pending the user's Paystack keys. After that: Phase C (AI sermon assistant) per the platform roadmap.

---

## Open Questions (resolved defaults)
- Intervals weekly/monthly/annually; plan name `Kharis {Interval} {CUR} {amount}`.
- Same-email/same-plan/different-fund correlation edge accepted + documented (spec §6).
- Subscription amount changes: cancel + re-subscribe (out of scope).
