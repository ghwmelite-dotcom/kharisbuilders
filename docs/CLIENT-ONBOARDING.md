# Client Onboarding — Spin up a church site in ~15 minutes

This is the operator runbook for standing up a **new client church** on your own Cloudflare
account, each on its own subdomain (e.g. `gracechapel.ohwpstudios.org`). One client = one clone =
one Cloudflare Worker with its own database, storage, and search index — fully isolated from every
other client.

> **Audience:** you (the operator). For day-to-day editing that you hand to the church, see
> **[ADMIN-GUIDE.md](ADMIN-GUIDE.md)**. For the big-picture tour, see **[SYSTEM-GUIDE.md](SYSTEM-GUIDE.md)**
> or the interactive **[guide.html](guide.html)**.

---

## What you need once (operator setup)

- A **Cloudflare account** and the **Wrangler CLI** logged in: `npx wrangler login`.
- Your **account ID** — run `npx wrangler whoami` and copy the ID for the account you want to deploy
  into. (Throughout this guide the placeholder is `YOUR_ACCOUNT_ID`.)
- The **apex domain on Cloudflare** (e.g. `ohwpstudios.org` added as a zone in that account, with its
  nameservers pointed at Cloudflare). Every client gets a subdomain of it. This is the only DNS
  prerequisite, and it's a one-time thing.
- **Node 18+** and a clone of this repo's `main` branch.

---

## The flow at a glance

```
1. Configure   → edit scripts/new-church.config.json
2. Provision   → one command: creates resources + custom domain + deploys
3. Protect     → Cloudflare Access in front of /admin  (REQUIRED — do not skip)
4. Secrets     → Turnstile (always), Paystack (if giving), Resend (optional)
5. Finish      → reindex AI, replace placeholder content, hand over
```

Steps 1–2 are one command. Steps 3–4 are quick dashboard/CLI actions you do once per client.

---

## 1. Configure

Copy the example and fill it in for the client:

```bash
cp scripts/new-church.config.example.json scripts/new-church.config.json
```

| Field | What to put |
| :-- | :-- |
| `name`, `tagline`, `description` | The church's identity (titles, SEO, footer). |
| `slug` | Lowercase `a-z0-9-`, 2–40 chars. **Drives every Cloudflare resource name** (worker, D1, R2 `<slug>-media`, Vectorize `<slug>-sermons`, KV `<slug>-SESSION`). Use the client's short name, e.g. `grace-chapel`. |
| `url` | The public origin — set it to the custom domain, e.g. `https://gracechapel.ohwpstudios.org`. |
| `customDomain` | The hostname to attach, e.g. `gracechapel.ohwpstudios.org`. Leave `""` to deploy to a `*.workers.dev` URL instead. **The apex (`ohwpstudios.org`) must already be a Cloudflare zone in the target account.** |
| `currency` | 3-letter code (`USD`, `GHS`, …) — only matters if giving is on. |
| `timezoneOffsetMin` | Minutes the church's local time is ahead of UTC (Accra = 0, EST = -300). Used by the live-status window and event calendar files. |
| `motifs` | `true` for the Adinkra/kente flourishes, `false` for a neutral look. |
| `theme` | Four hex colours (`primary`, `accent`, `dark`, `surface`) — the whole palette derives from these. |
| `features` | Per-area on/off: `sermons`, `events`, `ministries`, `giving`, `ai`, `live`, `community`. Turn `giving` **off** until the client has Paystack keys. |

---

## 2. Provision (one command)

Preview first (runs nothing):

```bash
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID node scripts/new-church.mjs --provision --dry-run
```

Then do it for real:

```bash
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID node scripts/new-church.mjs --provision --yes
```

This creates the D1 database, KV namespace, R2 bucket, and (if `ai` is on) the Vectorize index;
applies all migrations; seeds starter content; sets a development Turnstile secret; builds; and
deploys — attaching the custom domain in the process. At the end you'll see
`<your-domain> (custom domain)` and a live URL.

> The command is **safe to re-run** — if a resource already exists it's reused, not duplicated.

**Seed sample sermons & events** (optional, makes a demo look populated and lets you show AI search):

```bash
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler d1 execute <slug> --remote --file db/seed_sermons_events.sql
```

---

## 3. Protect the admin with Cloudflare Access — REQUIRED

Until you do this, `/admin` is **locked** (it fails closed — staff can't sign in). Cloudflare Access
is what lets your chosen emails in, with a one-time PIN or Google — no passwords stored in the app.

> Access is configured in the **Cloudflare dashboard** (or the Cloudflare API). Wrangler can't manage
> it. Do this once per client.

1. Go to **[one.dash.cloudflare.com](https://one.dash.cloudflare.com)** → select the **target
   account** → **Zero Trust**. If it's your first time, you'll be asked to pick a **team name**
   (e.g. `ohwpstudios`) and the free plan — do that once for the account.
2. **Access → Applications → Add an application → Self-hosted.**
3. **Application name:** e.g. `Grace Chapel Admin`. **Session duration:** 24 hours is fine.
4. **Add a public hostname / domain** for the app, twice (same app):
   - `<your-domain>` with **path** `admin`
   - **Add domain** again: `<your-domain>` with **path** `api/admin`
   (Covering both paths protects the admin pages *and* the admin API.)
5. **Identity:** accept **One-time PIN** (email) and/or add Google. Next.
6. **Add a policy:** name `Staff`, **Action: Allow**, **Include → Emails →** the staff addresses
   (yours + the church's admins). Save / Next → **Add application**.

Now visiting `https://<your-domain>/admin` prompts for the email PIN before the site loads. The app
reads the verified email from Cloudflare's header as the editor identity (shown in audit fields).

---

## 4. Secrets

The provisioner sets a **development** Turnstile secret (a test key that accepts everything). For a
real site, set real values (each is per-client, run from the repo with the client's `wrangler.jsonc`
active):

```bash
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler secret put TURNSTILE_SECRET_KEY   # spam protection
# if giving is on:
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler secret put PAYSTACK_SECRET_KEY
# optional staff email notifications:
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler secret put RESEND_API_KEY
```

Create a **Turnstile widget** for the client's hostname in the Cloudflare dashboard; you'll paste its
**site key** in the next step and its **secret** is what you set above.

---

## 5. Finish & hand over

In **`https://<your-domain>/admin` → Settings**:

- Paste the Turnstile **site key** (`turnstile_site_key`) so public forms (visit, registration,
  prayer, group/serve signups) work for real visitors.
- If **giving** is on: set `paystack_public_key`, `currency`, `giving_enabled = true`, and set the
  Paystack webhook to `https://<your-domain>/api/webhooks/paystack`.

Then:

- **Admin → Sermons → "Reindex AI search"** once (when `ai` is on and sermons exist) to switch from
  keyword to semantic search and power "Ask the Pastor."
- Replace the placeholder images and copy throughout the admin with the church's real content.
- Hand the church staff the **[ADMIN-GUIDE.md](ADMIN-GUIDE.md)** — they can run everything from
  `/admin` without touching code.

---

## Updating a client later

To ship new template features to an existing client:

```bash
git fetch origin && git merge origin/main      # bring in the latest template
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler d1 migrations apply <slug> --remote   # if there are new migrations
npm run build && CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler deploy
```

Keep each client on its own branch (or its own clone) so its `src/config/church.ts` and
`wrangler.jsonc` identity stay put. The `.gitattributes merge=ours` rule already protects those
three identity files during a merge from `main`.

---

## Removing a client (teardown)

```bash
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler delete                                   # the worker (frees the custom domain)
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler d1 delete <slug>
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler r2 bucket delete <slug>-media
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler vectorize delete <slug>-sermons
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID npx wrangler kv namespace delete --namespace-id <id>  # find with: wrangler kv namespace list
```

Also delete the Cloudflare Access application for that hostname in Zero Trust.

---

## Worked example — the demo

The reference deployment was created with exactly this flow:

| | |
| :-- | :-- |
| Name / slug | Cornerstone Community Church / `church-demo` |
| Account | `ea2eb3a9813660dfca2a60e594858538` (Ghwmelite) |
| Domain | `church.ohwpstudios.org` |
| Features | all on except `giving` |
| Source branch | `deploy/ohwp-church-demo` |

Command used:

```bash
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 node scripts/new-church.mjs --provision --yes
```
