# Phase B2: Paystack Recurring Giving — Design Spec

**Date:** 2026-06-03
**Status:** Approved (design), pending spec review
**Builds on:** Phase B1 (one-time giving) — `docs/superpowers/specs/2026-06-03-paystack-giving-design.md`. Reuses B1's signed webhook router, `donations` table, Paystack client, money/reference helpers, and `/giving` page.

---

## 1. Purpose & Goals

Let givers set up a **recurring** gift (weekly / monthly / annual) in GHS via Paystack, on top of the existing one-time flow. Paystack auto-charges each cycle; we record every charge as its own donation and let staff see and cancel active recurring gifts.

**Success criteria**
- A giver can choose Recurring + interval + amount + fund on `/giving` and complete the first payment via mobile money/card.
- Each subsequent automatic charge is recorded as a donation, designated to the same fund, with no manual work.
- Givers can stop a recurring gift via Paystack's emailed manage link; staff can cancel from the admin.
- Recurring charges flow into existing giving totals (one donation row per cycle).

**Decisions locked in (from brainstorming)**
- Intervals: **weekly, monthly, annually**.
- Cancellation: **Paystack email link + admin cancel**.
- Cycle records: **one donation row per successful charge** (`type='recurring'`, linked to its subscription).

---

## 2. Scope

**In scope:** plans cache + subscriptions data model; `/giving` one-time/recurring toggle + interval; recurring initialize path (ensure plan → subscribe); webhook handling for `subscription.create`, recurring `charge.success`, `invoice.payment_failed`, `subscription.disable`/`subscription.not_renew`; admin subscriptions list + cancel; tests.

**Out of scope (deferred):** giver self-service portal beyond Paystack's hosted manage link (Phase F member accounts); upgrading/downgrading an existing subscription's amount (giver cancels + re-subscribes); proration; pausing.

---

## 3. How Paystack Recurring Works (reference)

1. Create a **plan** once per (amount, interval, currency) via `POST /plan` → returns `plan_code`.
2. Initialize a transaction with `plan: <plan_code>` + `email` (amount comes from the plan) → redirect to checkout → first charge.
3. Paystack creates a **customer** + **subscription** and fires `subscription.create` (with `subscription_code`, `email_token`, `customer`, `plan`, `next_payment_date`).
4. Every cycle, Paystack charges automatically and fires `charge.success` (and invoice events). On failure: `invoice.payment_failed`. On end/cancel: `subscription.disable` / `subscription.not_renew`.
5. Cancel via `POST /subscription/disable` with `{ code: subscription_code, token: email_token }`. Paystack also emails each subscriber a hosted manage/cancel link (enabled in dashboard settings).

---

## 4. Data Model

### New table `plans` (Paystack plan cache)
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| plan_code | TEXT NOT NULL UNIQUE | Paystack `PLN_...` |
| name | TEXT NOT NULL | e.g. "Kharis Monthly GHS 100" |
| amount | INTEGER NOT NULL | minor units (pesewas) |
| interval | TEXT NOT NULL | `weekly` / `monthly` / `annually` |
| currency | TEXT NOT NULL DEFAULT 'GHS' | |
| created_at | TEXT DEFAULT datetime('now') | |

Unique business key: (amount, interval, currency) — enforced via a UNIQUE index so we never create two Paystack plans for the same trio.

### New table `subscriptions`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| local_ref | TEXT NOT NULL UNIQUE | our correlation id (`kb_sub_...`) generated at initialize |
| subscription_code | TEXT UNIQUE | Paystack `SUB_...`; null until `subscription.create` |
| email_token | TEXT | needed to cancel via Paystack |
| customer_code | TEXT | Paystack `CUS_...` |
| customer_email | TEXT NOT NULL | |
| plan_id | INTEGER | FK → plans(id) |
| plan_code | TEXT NOT NULL | denormalized for correlation |
| amount | INTEGER NOT NULL | pesewas |
| interval | TEXT NOT NULL | |
| fund_id | INTEGER | FK → funds(id) ON DELETE SET NULL |
| status | TEXT NOT NULL DEFAULT 'pending' | pending → active → (attention) → cancelled |
| next_payment_at | TEXT | from Paystack |
| created_at | TEXT DEFAULT datetime('now') | |
| updated_at | TEXT DEFAULT datetime('now') | |

**Indexes:** unique on `local_ref`, unique on `subscription_code`, index on `(customer_email, plan_code)` (correlation lookup), index on `status`.

### Alter `donations`
Add nullable `subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL`. Recurring charges set it; one-time donations leave it null.

---

## 5. Components & Boundaries

Pure logic is dependency-injected (Paystack via injected `fetch`) and unit-tested offline; D1 access via the Miniflare harness; routes stay thin.

**Paystack client additions (`src/lib/paystack/client.ts`)**
- `createPlan({ name, amount, interval, currency }, cfg)` → `{ ok, planCode } | { ok:false }`.
- `disableSubscription({ code, token }, cfg)` → `{ ok } | { ok:false }`.
- `initializeTransaction` already exists — extend `InitializeParams` with optional `plan?: string` (when present, sent as `plan` and `amount` is omitted since the plan defines it).

**Plans data access (`src/lib/db/plans.ts`)**
- `getPlanByKey(db, amount, interval, currency)`, `insertPlan(db, {...})`, `getPlanByCode(db, code)`.

**Subscriptions data access (`src/lib/db/subscriptions.ts`)**
- `createPendingSubscription(db, {...})` (status pending, with local_ref, plan_code, fund_id, email, amount, interval).
- `activateSubscription(db, { customerEmail, planCode, subscriptionCode, emailToken, customerCode, nextPaymentAt })` — correlates the most-recent pending sub by (email, plan_code), fills Paystack ids, status→active. Idempotent (no-op if already active for that code).
- `getSubscriptionByCode(db, code)`, `getActiveSubscriptionForCharge(db, { customerEmail, planCode })` (for recurring charge correlation), `setSubscriptionStatus(db, code, status)`, `setNextPayment(db, code, at)`, `listSubscriptions(db, { status? })`.

**Plan provisioning (`src/lib/giving/ensure-plan.ts`)**
- `ensurePlan(db, { amount, interval, currency }, cfg)` — look up cached plan; if absent, `createPlan` via Paystack, `insertPlan`, return code. Pure-ish (takes db + injected fetch).

**Initialize pipeline (`src/lib/giving/initialize-handler.ts`, extended)**
- Read `type` (`one_time` | `recurring`) and `interval` from the form. One-time path unchanged.
- Recurring path: validate amount + interval (enum) → Turnstile → `ensurePlan` → generate `local_ref` + create pending subscription (with fund) → create pending donation (first charge, `type='recurring'`, fund) → `initializeTransaction` with `plan` → redirect. On any failure, redirect back with an error (no orphaned charge).

**Webhook dispatcher (`src/lib/giving/webhook-handler.ts`, extended)** — events handled:
- `subscription.create` → `activateSubscription` (correlate by email + plan_code; store code/email_token/customer/next payment).
- `charge.success` →
  - if `data.reference` matches an existing donation (the first charge) → `markDonationSuccess` (existing B1 behaviour, amount-checked) and link it to the subscription if recurring.
  - else (automatic cycle, no pre-existing reference) → look up the active subscription by (customer email, plan_code) → create a NEW donation (`type='recurring'`, `subscription_id`, fund from sub, amount from event, status success, reference = Paystack's charge reference) idempotently (skip if a donation with that reference already exists).
- `invoice.payment_failed` → `setSubscriptionStatus(code, 'attention')`.
- `subscription.disable` / `subscription.not_renew` → `setSubscriptionStatus(code, 'cancelled')`.
- `invoice.create` / `invoice.update` → update `next_payment_at` if present (best-effort, optional).

**Admin (`src/pages/admin/subscriptions.astro` + `src/pages/api/admin/subscriptions.ts`)**
- List subscriptions (status, giver email, amount, interval, fund, next payment).
- Cancel action → gated POST → `disableSubscription` (Paystack) → on ok, `setSubscriptionStatus(code,'cancelled')`. Nav gains "Recurring".

**Public form (`src/pages/giving.astro`, extended)**
- A **One-time / Recurring** segmented toggle. Selecting Recurring reveals an **interval** select (Monthly / Weekly / Annual). Hidden `type` field switches; interval only submitted for recurring. Copy clarifies "You'll be charged GHS X every {interval} until you cancel."

---

## 6. Correlation Strategy (the nuanced part)

Paystack subscription events don't reliably carry our transaction `metadata`, so we correlate our fund/intent to the Paystack subscription via **(customer_email, plan_code)**:

1. At initialize we create a **pending subscription** row with the giver's email, the plan_code, and chosen fund.
2. `subscription.create` arrives with the same email + plan_code → we fill in the Paystack `subscription_code` / `email_token` and mark it active (most-recent pending match).
3. Recurring `charge.success` (no original reference) → find the **active** subscription by (email, plan_code) → take its fund for the new donation row.

**Known limitation (documented):** if the *same person* subscribes *twice to the identical amount+interval* for *different funds*, the second subscription/charges could attach to the first's fund. Rare for a church; if it ever matters we make plans fund-specific (include fund in the plan business key). Logged, not silently ignored.

---

## 7. Error Handling

- Invalid interval/amount or failed Turnstile → redirect back to `/giving?error=...`; no plan/subscription/donation created.
- `ensurePlan` Paystack failure → redirect `/giving?error=init`; no pending rows committed for the subscription (create pending rows only after the plan code is in hand).
- `subscription.create` for an unknown (email, plan_code) with no pending row → create the subscription row from the event anyway (status active) with `fund_id` null, so charges still record (unattributed) rather than being lost.
- Recurring `charge.success` with no matching active subscription → still record the donation with `subscription_id` null + `fund_id` null (never drop a real payment); log for reconciliation.
- All webhook writes idempotent (guard by reference / subscription_code).
- Webhook signature + amount checks identical to B1.

---

## 8. Security

- Same as B1: secret server-only; HMAC-SHA512 raw-body signature on the webhook; amount re-checked on confirm; Turnstile + CSRF on the form; admin behind Cloudflare Access + `requireAdmin`.
- `email_token` (cancellation credential) is stored server-side only, never exposed to the client.
- Cancel endpoint is admin-gated; the giver's own cancel goes through Paystack's hosted link (no secret on our side).

---

## 9. Testing Strategy

**Pure / injected-fetch unit tests:**
- `client.createPlan` / `disableSubscription`: correct endpoint, auth header, body; ok/false mapping; network error → ok:false.
- `ensure-plan`: cache hit returns code without calling Paystack; cache miss creates + inserts; injected fetch asserts a single create.
- `initialize-handler` (recurring): invalid interval rejected; valid recurring creates pending subscription + pending donation + redirects with `plan`; one-time path still works (regression).

**D1 (Miniflare) tests:**
- `plans`: getByKey/insert/unique (amount,interval,currency).
- `subscriptions`: createPending → activate (correlation by email+plan_code) → status active + code stored; setStatus; getActiveForCharge; idempotent activate.
- `webhook-handler` extended: `subscription.create` activates; recurring `charge.success` (no prior reference) creates a `type=recurring` donation linked to the sub with the sub's fund; duplicate charge reference is a no-op; `invoice.payment_failed`→attention; `subscription.disable`→cancelled; first-charge `charge.success` still marks the pending donation (B1 regression).

**Manual/dev e2e (needs Paystack TEST keys):** recurring gift → checkout (test card) → subscription.create activates the sub → first charge donation recorded → simulate/await a cycle charge → second donation recorded → admin cancel disables on Paystack and flips status.

Migrations auto-applied by the harness.

---

## 10. Rollout

1. Build B2 against mocks: all unit + D1 tests green, build green. Ships dark behind the same `giving_enabled` flag.
2. With the user's Paystack TEST keys already wired (from B1 go-live), enable recurring (it's part of the same `/giving` page once deployed).
3. Test-mode: create a recurring sub, verify subscription.create + first charge, cancel from admin.
4. Live keys: confirm webhook URL already covers subscription events (same endpoint), do a small live recurring test, then cancel.

---

## 11. Open Questions (resolved defaults)
- Intervals fixed to weekly/monthly/annually (Paystack supports more; YAGNI).
- Plan naming: `Kharis {Interval} {CURRENCY} {major-amount}` (human-readable in Paystack dashboard).
- Same-email/same-plan/different-fund correlation edge: accepted + documented (§6).
- Updating a subscription amount: out of scope — cancel + re-subscribe.
