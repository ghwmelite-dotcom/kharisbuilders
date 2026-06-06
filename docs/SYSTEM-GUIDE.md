# Your Church Website — The Complete Guide

A friendly, plain-English tour of the whole system: what it is, how to run it, how to put it
live, and how to spin up a brand-new church. No prior knowledge assumed.

> **In one sentence:** this is a complete, modern church website **plus** a simple admin area where
> non-technical staff can change everything — words, photos, sermons, events, giving — without ever
> touching code.

---

## 1. The 30-second mental model

There are three parts. That's it.

```
        ┌──────────────────────────┐
        │      VISITORS            │   people who come to your website
        └────────────┬─────────────┘
                     │  see
                     ▼
        ┌──────────────────────────┐
        │   THE PUBLIC WEBSITE     │   home, about, sermons, events, giving, watch…
        └────────────┬─────────────┘
                     │  shows content from
                     ▼
        ┌──────────────────────────┐
        │      THE ADMIN           │   you sign in here to change everything
        │   (yoursite.com/admin)   │
        └──────────────────────────┘
```

Everything you type or upload in **the admin** instantly appears on **the public website**.
Underneath, it all runs on **Cloudflare** (the hosting company) — but you almost never need to
think about that. (If a word below is unfamiliar, jump to the **Glossary** at the end.)

---

## 2. Find your path

Pick the one that sounds like you:

| You are… | Go to | Also read |
| :-- | :-- | :-- |
| 🧑‍🤝‍🧑 **Church staff** updating the site | [§3 Running it day-to-day](#3-running-the-website-day-to-day) | **[ADMIN-GUIDE.md](ADMIN-GUIDE.md)** (full steps) |
| 🛠️ **The person who keeps it online** | [§4 Operating & going live](#4-operating--going-live) | [§6 Glossary](#6-plain-english-glossary) |
| 💻 **A developer / launching a new church** | [§5 Launch a new church](#5-launch-a-brand-new-church) | **[README.md](../README.md)** |

---

## 3. Running the website day-to-day

**Everything is at `https://your-site/admin`.** You sign in with your email and a one-time code
(no password to remember). Then use the sidebar menu.

Here's what each thing does — full click-by-click steps are in **[ADMIN-GUIDE.md](ADMIN-GUIDE.md)**:

| I want to… | Where | Quick note |
| :-- | :-- | :-- |
| Change wording on a page | **Content** | Pick a page, edit the boxes, **Save**. Empty a box to restore the original wording. |
| Replace a photo | **Content** (image slots) | Upload a JPG/PNG (≤6 MB). Saving text never deletes a photo. |
| Add a sermon | **Sermons** | Paste the YouTube/Vimeo link; optionally paste a transcript (powers the AI). Tick **Published**. |
| Add an event | **Events** | Set date, location, optional **registration** + capacity. Each event auto-offers **Add to calendar** (.ics + Google) and shows **"spots left."** |
| List a ministry | **Ministries** | Name, description, leader, photo. Tick **Published**. |
| Edit leaders / your story | **Leadership** / **Journey** | Simple lists shown on the About page. |
| Take prayer requests | **Prayer** | Approve / hide / delete. Approved ones show **anonymously** on the Prayer wall; visitors can tap "I prayed." |
| Follow up next steps | **Connect** | People who chose a next step (new here, baptism, serve…). Mark **Contacted**/**Done**. |
| Manage small groups | **Groups** / **Group Signups** | Group cards for the **/groups** finder, plus the "I'm interested" follow-up list. |
| Recruit volunteers | **Serve Roles** / **Serve Signups** | Role cards for the **/serve** board, plus the "I want to serve" follow-up list. |
| See who reached out | **People** | Everyone who submitted the **Visit** form (prayer/connect/group/serve have their own lists above). |
| Manage online giving | **Funds**, **Giving**, **Recurring** | Create funds, see donations, export CSV, cancel a recurring gift. |
| Run the live-stream page | **Live** | Set the stream link and an Auto/Live/Off switch. |
| Change service times, address, socials | **Settings** | These show in the footer and on the Visit page. |

**Three golden rules**
1. Changes go live the moment you click **Save**.
2. Sermons, events, ministries, groups, and serving roles only appear publicly when marked **Published**.
3. In the page-text editor, clearing a box and saving brings back the original wording — you can't
   break a page by emptying a field.

---

## 4. Operating & going live

This section is for whoever keeps the site running.

### Where it lives
The site is a single **Cloudflare Worker** (think: the website's engine) plus a **database** (D1),
**file storage** for photos (R2), and some **AI** for sermon search. It's served at a web address
like `https://your-church.your-account.workers.dev` (or your own domain later).

### Updating the live site
The code lives in two branches on GitHub:
- **`main`** — the generic, shareable template.
- **`kharis`** (or your church's branch) — what's actually deployed live, with your church's name,
  colours, and settings.

To ship new features/fixes to the live site:
```bash
git checkout kharis        # your live branch
git merge main             # bring in the latest improvements (your branding is kept automatically)
npm run build              # build the site
npx wrangler deploy        # push it live
```
> One-time setup per computer: `git config merge.ours.driver true` (keeps your church's config files
> from being overwritten when you merge the template).

### Going live — the activation checklist
The site runs immediately, but a few things stay **off / on test mode** until you switch them on.
Each is a quick, one-sitting task:

| Service | What it unlocks | How |
| :-- | :-- | :-- |
| **Paystack** | Online giving | Create account → keys → `wrangler secret put PAYSTACK_SECRET_KEY` → in **Settings** set `paystack_public_key`, `currency`, `giving_enabled=true` → set the webhook to `https://your-site/api/webhooks/paystack`. |
| **Turnstile** | Real spam protection on forms | Make a widget in Cloudflare → `wrangler secret put TURNSTILE_SECRET_KEY` → in **Settings** set `turnstile_site_key` (must match!). |
| **Resend** | Staff email alerts on new visitors | Account + verified domain + key → `wrangler secret put RESEND_API_KEY` (+ `STAFF_EMAIL`, `FROM_EMAIL`). |
| **Cloudflare Access** | Locks the `/admin` area | In Zero Trust → Access, allow each staff member's email. |
| **AI search** | Smart sermon search + "Ask the Pastor" | Admin → **Sermons** → **"Reindex AI search"** (run once after adding lots of sermons). |

Until you do these: giving shows "coming soon", forms use always-pass test keys, email alerts are
silently skipped, and sermon search falls back to simple keyword matching. **Nothing breaks** — these
just stay dormant.

---

## 5. Launch a brand-new church

The whole thing is a **re-skinnable template** — one config file turns it into any church's site.

1. **Clone** the project and run `npm install`.
2. **Fill in one file:**
   ```bash
   cp scripts/new-church.config.example.json scripts/new-church.config.json
   # edit it: name, slug, web address, brand colours, currency, timezone, which features to enable
   ```
3. **Run one script:**
   ```bash
   node scripts/new-church.mjs
   ```
   It writes the church's config, names all the cloud resources, re-tints the placeholder images to
   the new brand colours, and generates a **`PROVISIONING.md`** with the exact next commands.
4. **Follow `PROVISIONING.md`** — it lists everything to create the database, storage, search index,
   set secrets, lock the admin, and deploy. (It adapts to the features you enabled.)
5. **Commit and deploy.** Done — a fully working church site in your brand.

Full details: **[README.md](../README.md)** ("Spin up a new church").

---

## 6. Plain-English glossary

| Term | In plain words |
| :-- | :-- |
| **Cloudflare** | The company that hosts and runs the website. |
| **Worker** | The "engine" that serves your website on Cloudflare. |
| **D1** | The **database** — stores your text, sermons, events, donations, settings. |
| **R2** | **File storage** — where uploaded photos live. |
| **Workers AI / Vectorize** | The **smart sermon features** — semantic search, study guides, "Ask the Pastor". |
| **Cloudflare Access** | The **lock on the admin** — only approved emails get in (sign in with a one-time code). |
| **Turnstile** | A friendly **spam shield** on your forms (replaces the old annoying CAPTCHAs). |
| **Paystack** | The **payments** provider that powers online giving. |
| **Resend** | The service that **sends staff email** alerts. |
| **`main` / `kharis` branch** | `main` = the shareable template; your church branch = what's live. |
| **`wrangler`** | The command-line tool that **deploys** the site to Cloudflare. |
| **Published** | A toggle — content only shows on the public site when it's **Published**. |

---

## 7. Quick fixes ("help, something's wrong")

| Symptom | Likely fix |
| :-- | :-- |
| I changed something but don't see it | Did you click **Save**? Is the item **Published**? Refresh the page. |
| I want the original wording back | Clear the text box and **Save**. |
| A photo won't upload | Must be under 6 MB and a JPG/PNG/WebP. |
| A photo shows broken / blank | The stored image path may be wrong — re-upload it in **Content**. |
| The website name or logo is wrong | Set once in the config (`src/config/church.ts`) — ask whoever runs the technical side. |
| I'm locked out of the admin | Ask your administrator to approve your email in Cloudflare Access. |
| Online giving says "coming soon" | Paystack isn't switched on yet — see [§4 going-live](#4-operating--going-live). |
| Sermon search seems basic | Run **Admin → Sermons → Reindex AI search** once. |

---

*New here? Start at the top — §1 gives you the whole picture in 30 seconds, then §2 points you to
exactly the part you need.*
