# Phase B: Paystack Online Giving — Design Spec

**Date:** 2026-06-03
**Status:** Approved (design), pending spec review
**Project:** KharisBuilders church website (Astro 6 SSR + Cloudflare D1/R2, gated admin via Cloudflare Access)

---

## 1. Purpose & Goals

Let the congregation give money online — including the **online congregation** the platform serves — using payment methods that work for an African (Ghana) audience: **mobile money (MTN/Vodafone/AirtelTigo), USSD, and cards**. Staff manage where gifts are designated and see what came in, without touching code.

**Success criteria**
- A visitor can complete a one-time gift in GHS from a phone using mobile money.
- Every gift is recorded with its fund designation and an auditable payment status driven by a verified webhook.
- Staff can manage funds and review/export donations from the admin.
- Secrets never reach the browser; webhook authenticity is cryptographically verified.

**Decisions locked in (from brainstorming)**
- Currency: **GHS** (configurable via a site setting, default GHS).
- Giving types: **one-time + recurring**, sequenced as **B1 (one-time)** then **B2 (recurring)**.
- Funds: **configurable, admin-managed designations**.
- Receipts: **rely on Paystack's automatic receipt** (no dependency on the not-yet-configured Resend email).

---

## 2. Scope

This spec covers **Phase B1 (one-time giving)** in implementation detail and **outlines Phase B2 (recurring)**. B1 is a complete, shippable feature on its own. B2 is a separate spec/plan/implementation cycle layered on B1's data and webhook plumbing.

**In scope (B1):** giving page, server-side Paystack initialize + verify, signed webhook, funds + donations data model, admin funds CRUD and donations review/export, configuration + secret handling, Turnstile anti-abuse, tests.

**Out of scope (B1, deferred):** recurring/subscriptions (B2), member donor accounts and giving history (Phase F), branded church receipt emails (needs A3 Resend), Gift Aid / tax statements, refunds from admin (handle in Paystack dashboard for now), multi-currency switching UI (single configured currency).

---

## 3. Integration Approach

**Paystack Standard (redirect) flow, server-initialized.** Rationale:
- The browser never receives the secret key; initialization happens in the Worker.
- Paystack's hosted checkout natively supports Ghana mobile money + USSD + cards, with better mobile UX than the inline popup.
- A signed webhook is the source of truth; the post-payment callback is UX only.

**Why not inline popup:** exposes flow to client JS, weaker mobile-money handling, and still requires the same server verify + webhook. Redirect is simpler and more robust.

### Payment lifecycle

```
Giver fills /giving form
   → POST /api/giving/initialize  (CSRF + Turnstile verified)
       → server validates amount/fund/email
       → insert donations row (status=pending, our reference)
       → Paystack POST /transaction/initialize  (secret key, amount in pesewas, currency, reference, callback_url, metadata)
       → 303 redirect to authorization_url (Paystack hosted checkout)
Giver pays on Paystack (momo/USSD/card)
   → Paystack redirects to /giving/callback?reference=...&trxref=...
       → server GET /transaction/verify/:reference  (secret key)
       → if success: idempotently mark donation success → thank-you page
       → else: show pending/failed messaging
Asynchronously:
   Paystack → POST /api/webhooks/paystack   (x-paystack-signature: HMAC-SHA512(body, secret))
       → verify signature → on charge.success: idempotently mark donation success (source of truth)
```

Both callback and webhook converge on the same idempotent state update keyed by `reference`. Whichever arrives first wins; the second is a no-op.

---

## 4. Data Model (new migrations)

### `funds`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | e.g. "Building Fund" |
| slug | TEXT NOT NULL UNIQUE | generated via existing `slugify`/`uniqueSlug` |
| description | TEXT | optional |
| sort_order | INTEGER NOT NULL DEFAULT 0 | display order |
| active | INTEGER NOT NULL DEFAULT 1 | inactive funds hidden from /giving |
| created_at / updated_at | TEXT DEFAULT datetime('now') | |
| updated_by | TEXT | admin email |

Seed with: General Offering, Tithe, Building Fund, Missions & Outreach.

### `donations`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| reference | TEXT NOT NULL UNIQUE | our generated id, used with Paystack |
| email | TEXT NOT NULL | required (Paystack receipt) |
| name | TEXT | optional |
| amount | INTEGER NOT NULL | **minor units (pesewas)**, integer only |
| currency | TEXT NOT NULL DEFAULT 'GHS' | |
| fund_id | INTEGER | FK → funds(id) ON DELETE SET NULL |
| type | TEXT NOT NULL DEFAULT 'one_time' | future: 'recurring' |
| status | TEXT NOT NULL DEFAULT 'pending' | 'pending' / 'success' / 'failed' |
| channel | TEXT | from Paystack (mobile_money/card/ussd…), set on success |
| paystack_status | TEXT | raw Paystack status string |
| paid_at | TEXT | set when status→success |
| metadata | TEXT | JSON (fund name snapshot, etc.) |
| created_at | TEXT DEFAULT datetime('now') | |

> D1 **does** enforce FKs under the runtime/Miniflare. `ON DELETE SET NULL` keeps historical donations if a fund is later deleted. Deleting a fund must not cascade-delete donations.

**Indexes:** `donations(reference)` (unique already), `donations(status)`, `donations(fund_id)`, `donations(created_at)`.

---

## 5. Money Handling

- The giving form collects a **major-unit amount** (GHS, e.g. `100` or `50.50`).
- Server converts to **integer pesewas**: `Math.round(amount * 100)`. Store and send to Paystack in pesewas.
- Validation: amount must parse to a positive number; enforce **min GHS 1** and a sane **max (e.g. GHS 100,000)** to bound abuse; reject non-finite/NaN; round to 2 decimals before conversion.
- Display amounts back to users by dividing by 100 with 2-decimal formatting and the currency code.
- A pure, tested helper module owns all conversion/formatting/validation — no inline arithmetic in routes.

---

## 6. Components & Boundaries

Each unit has one responsibility, takes its dependencies as parameters, and is independently testable. Paystack HTTP calls are made through an injected `fetch` so handlers test offline.

**Pure / library (`src/lib/`)**
- `giving/money.ts` — `toMinorUnits(major)`, `fromMinorUnits(minor)`, `formatAmount(minor, currency)`, `validateAmount(input)` → `{ ok, minor } | { ok:false, error }`.
- `giving/reference.ts` — `makeReference()` → unguessable unique id (e.g. `kb_` + 16 random hex). Collision-safe at scale; uniqueness also enforced by DB constraint.
- `paystack/signature.ts` — `verifyWebhookSignature(rawBody, signatureHeader, secret)` → boolean, using **HMAC-SHA512** via WebCrypto (`crypto.subtle`), constant-time compare.
- `paystack/client.ts` — thin typed wrapper: `initializeTransaction(params, {secret, fetch})` and `verifyTransaction(reference, {secret, fetch})`. Returns normalized results; never throws on Paystack business errors (returns `{ok:false}`).
- `giving/webhook-handler.ts` — `handlePaystackEvent(db, event)` — pure dispatch on `event.event`; for `charge.success` calls donations data-access to mark success idempotently. Unknown events → no-op success.
- `giving/initialize-handler.ts` — `handleInitialize(env, form, {fetch, origin, devMode})` — validates input (zod), Turnstile, creates pending donation, calls Paystack initialize, returns `{redirectUrl}` or `{error}`.

**Data access (`src/lib/db/`)**
- `funds.ts` — `listActiveFunds`, `listAllFunds`, `getFundById`, `createFund`, `updateFund`, `deleteFund`, `setFundActive` (prepared statements, `updated_by`, slug resolution).
- `donations.ts` — `createPendingDonation`, `getDonationByReference`, `markDonationSuccess(ref, {channel, paystackStatus, paidAt})` (idempotent — only transitions `pending`→`success`), `markDonationFailed`, `listDonations` (paginated/filter), `totalsByFund`, `donationTotals`.
- `schemas.ts` — add `DonationInputSchema` (zod: email required+valid, name optional, amount string→validated, fund_id coerce int, Turnstile token).

**Routes / pages (`src/pages/`)**
- `giving.astro` — public giving page (funds from `listActiveFunds`, amount tiles + custom, email/name, Turnstile, currency from settings, `giving_enabled` gate). Premium styling consistent with the site (PageHero etc.).
- `api/giving/initialize.ts` — POST; CSRF + `handleInitialize`; 303 to Paystack or back to `/giving?error=`.
- `giving/callback.astro` — reads `reference`, calls `verifyTransaction`, idempotently updates donation, renders thank-you / pending / failed.
- `api/webhooks/paystack.ts` — POST; reads **raw body**, `verifyWebhookSignature`, `handlePaystackEvent`; returns 200 quickly (signature failure → 401). Not behind Cloudflare Access (Paystack must reach it — see §8).
- `admin/funds/*` — list + new/edit (FundForm) + delete/activate, via gated `api/admin/funds.ts`.
- `admin/giving.astro` — donations table, totals per fund, **CSV export** (`admin/giving.csv.ts`), via existing admin auth.

**Config**
- `site_settings`: `paystack_public_key` (informational/public), `currency` (default `GHS`), `giving_enabled` (`'true'`/`'false'`).
- Wrangler secret: **`PAYSTACK_SECRET_KEY`** (server-only; `wrangler secret put`). `.dev.vars` holds a test secret for local dev.
- `notify` is unchanged; no email dependency in B1.

---

## 7. Error Handling

- **Invalid form input** (bad amount, missing email, no fund, failed Turnstile) → re-render `/giving` with an inline error, no Paystack call, no DB row.
- **Paystack initialize failure** (network/business error) → mark nothing paid; redirect back to `/giving?error=init` with a friendly message; the pending row may remain (harmless, stays `pending`).
- **Callback with unverifiable/failed reference** → thank-you page shows "we couldn't confirm your payment yet" with guidance; never shows success without verification.
- **Webhook signature invalid** → `401`, ignore. **Valid but unknown event** → `200`, no-op. **Valid `charge.success` for unknown reference** → `200`, no-op (defensive).
- **Idempotency:** `markDonationSuccess` only transitions `pending`→`success` and is safe to call repeatedly from both callback and webhook.
- **DB unavailable** on public pages → giving page degrades to a friendly "giving temporarily unavailable" rather than 500 (consistent with existing pages' try/catch pattern).

---

## 8. Security

- **Secret key server-only.** `PAYSTACK_SECRET_KEY` is a Wrangler secret, read via `env`, never sent to the client. Public key may be exposed but the redirect flow doesn't require it client-side.
- **Webhook signature:** verify `x-paystack-signature` = HMAC-SHA512 of the **raw request body** using the secret key, via WebCrypto, constant-time comparison. Reject mismatches with 401.
- **Webhook route must be publicly reachable** (Paystack origin). It is **not** under `/admin` or `/api/admin`, so Cloudflare Access does not block it. No extra Access config needed. (Optionally allowlist Paystack IPs later.)
- **Amount integrity:** amount is validated and converted server-side; min/max enforced. (For donations the giver chooses the amount, so we trust the validated client amount, but we still bound and sanitize it.)
- **Anti-abuse:** Turnstile on the giving form to deter card-testing/bots. CSRF origin check on POST (Astro default).
- **No PII in logs.** Donation rows hold email/name (needed); avoid logging them.
- **Admin surfaces** (`/admin/funds`, `/admin/giving`) stay behind Cloudflare Access + `requireAdmin`.

---

## 9. Testing Strategy

**Pure unit tests (node vitest, no runtime imports):**
- `money.ts`: major→minor rounding (100→10000, 50.5→5050, 0.1 edge), validateAmount min/max/NaN/negative.
- `reference.ts`: format + uniqueness across many calls.
- `signature.ts`: known HMAC-SHA512 vector passes; tampered body/signature fails; constant-time path.
- `webhook-handler.ts`: `charge.success` marks success (via fake db); unknown event no-op; unknown reference no-op.
- `paystack/client.ts`: with an injected `fetch` stub — initialize returns `{authorization_url, reference}`; verify maps success/failed; network error → `{ok:false}`.
- `initialize-handler.ts`: invalid input rejected pre-Paystack; valid input creates pending donation + returns redirect (fetch + turnstile stubbed).

**D1 tests (Miniflare harness):**
- `funds.ts`: create/list active vs all/update/slug uniqueness/delete (donations survive via SET NULL)/setActive.
- `donations.ts`: createPending → getByReference; markDonationSuccess idempotent (second call no-op, doesn't overwrite paid_at); markFailed; totalsByFund/donationTotals correctness.

**Manual/dev e2e (needs Paystack TEST keys):** initialize from `/giving` → redirected to Paystack test checkout → pay with test momo/card → callback shows success → webhook (via Paystack dashboard test event or live) flips/confirms status → admin shows the donation + fund total + CSV.

**Migrations applied by the test harness** automatically (`tests/helpers/d1.ts`).

---

## 10. Configuration & Rollout

1. Build B1 fully against **mocks** (no keys needed): all unit + D1 tests green, build green.
2. User creates a **Paystack account** (Ghana), gets **test** public + secret keys (dashboard → Settings → API Keys & Webhooks).
3. Wire keys: `wrangler secret put PAYSTACK_SECRET_KEY` (test), `paystack_public_key` + `currency=GHS` + `giving_enabled=true` into settings (admin), set the **webhook URL** in Paystack dashboard to `https://<origin>/api/webhooks/paystack`.
4. Dev/live **test-mode** end-to-end verification.
5. Go live: swap to **live** keys (secret via `wrangler secret put`, public key into settings), confirm webhook URL, small real test gift.

---

## 11. Phase B2 (Recurring) — Outline (separate cycle)

- New tables `plans` (cached Paystack plan codes by amount+interval+fund) and `subscriptions` (subscription_code, customer_code, email, amount, interval, fund_id, status, next_payment_at).
- `/giving` gains a **One-time / Recurring** toggle with **Monthly / Weekly** interval.
- Recurring path: ensure/create a Paystack **plan** (amount+interval) → initialize transaction with `plan` → Paystack creates the subscription on first charge.
- Webhooks added: `subscription.create`, recurring `charge.success` (insert a donation per cycle linked to the subscription), `invoice.payment_failed`, `subscription.disable`.
- Admin: subscriptions list + **cancel** (Paystack disable API).
- Its own spec → plan → implementation, built on B1's webhook router and donations table.

---

## 12. Open Questions (non-blocking)
- Min/max gift bounds: default **GHS 1–100,000**; adjust if the church wants different limits.
- Amount preset tiles: default **50 / 100 / 200 / 500 GHS** + custom; staff-editable later if desired.
- Paystack IP allowlisting on the webhook: deferred (signature verification is sufficient).
- Custom domain: when added, update the webhook URL + `callback_url` origin (derived from `Astro.site`, so mostly automatic).
