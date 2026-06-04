# Live / Online Campus — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending spec review
**Project:** KharisBuilders (Astro 6 SSR + Cloudflare D1/R2/KV, gated admin via Cloudflare Access). Serves a sizeable online congregation; this makes "watching online" a real campus.

---

## 1. Purpose & Goals

Give the online congregation a first-class live experience: a `/live` page that shows the stream when the church is live (with chat, connect, give, prayer, bulletin) and a warm "next gathering" hub when it isn't.

**Success criteria**
- Visitors see the live stream automatically during services and a countdown otherwise; the page flips live↔offline without a manual reload.
- Online viewers can connect (be known), give, request prayer, and read the bulletin from one page.
- Staff control everything from an Admin → Live page (stream URL, Auto/Live/Off, duration, bulletin, toggles) and see who connected.

**Decisions locked in (brainstorming):** live detection = scheduled windows + manual override; any-platform stream URL (YouTube-optimized); include online connect card + Give/Prayer + digital bulletin + embedded YouTube chat. Native real-time chat is out (later, Durable Objects).

---

## 2. Scope

**In scope:** `/live` page; live-status logic; stream/chat embedding; `/api/live/status` poll endpoint; online connect form + table + admin list; minimal prayer-request form + table + admin list; editable live config + bulletin; Admin → Live editor; "Watch" nav link; tests.

**Out of scope:** native real-time chat/reactions (Durable Objects); the public prayer **wall** + prayer-team workflow (the later Community phase — this ships only the in-service prayer *capture*); multi-service simultaneous streams; member-gated streams (needs accounts).

---

## 3. Live-Status Model

`isLive` and the next window are computed from three inputs: the **manual state**, the **schedule**, and **now** (in church-local time).

- **`live_state`** setting: `auto` | `live` | `off`.
  - `live` → force live (one-click "Go Live"); `off` → force offline (cancel a service); `auto` → follow the schedule.
- **Schedule:** the already-editable `home.gathering_schedule` JSON (`[{day,hour,min,label}]`) + a **`live_duration_min`** setting (default 90). Each entry defines a weekly window `[occurrence, occurrence+duration]`.
- **Church time:** a **`live_tz_offset_min`** setting (default **0** — Ghana/Accra is UTC+0 year-round), so windows compute correctly regardless of server (UTC) or viewer timezone.

Pure function `computeLiveStatus(schedule, durationMin, state, tzOffsetMin, now) → { isLive: boolean; endsAt?: ISO; next?: { label, at: ISO } }`. The page renders from this server-side; `/api/live/status` returns it as JSON; the client polls every ~30s and reloads when `isLive` changes.

---

## 4. Data Model

### New table `online_attendances`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| email | TEXT NOT NULL | |
| location | TEXT | "Accra, Ghana" / "London" |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

### New table `prayer_requests`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT | optional |
| email | TEXT | optional |
| request | TEXT NOT NULL | |
| is_private | INTEGER NOT NULL DEFAULT 1 | private = staff-only (no public wall yet anyway) |
| status | TEXT NOT NULL DEFAULT 'new' | new / prayed (future) |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

### Settings keys (key/value in `site_settings`; allowlisted in the Live admin route)
`live_stream_url`, `live_state` (`auto`), `live_duration_min` (`90`), `live_tz_offset_min` (`0`), `live_chat_enabled` (`true`), `live_connect_enabled` (`true`), `live_bulletin_title`, `live_bulletin_body`. No migration for these (settings table exists).

---

## 5. Components & Boundaries

**Live status (`src/lib/live/status.ts`)** — pure, tested: `computeLiveStatus(...)` as above; helpers for "occurrence of (day,hour,min) in the church-local week" and window containment.

**Embeds (`src/lib/live/embed.ts`)** — pure, tested: `toLiveEmbed(url, originHost) → { embedUrl: string | null; chatUrl: string | null }`.
- YouTube video (`watch?v=` / `youtu.be/` / `/live/<id>`) → `https://www.youtube.com/embed/<id>?autoplay=1&rel=0` + chat `https://www.youtube.com/live_chat?v=<id>&embed_domain=<originHost>`.
- YouTube channel-live (`/embed/live_stream?channel=…`) → pass through; no chat.
- Vimeo → `player.vimeo.com/video/<id>`; no chat. Facebook → FB video plugin URL; no chat.
- Anything else with `http(s)` → treat as a raw iframe `embedUrl`; no chat. Unparseable → `{ null, null }`.

**Form handlers (`src/lib/live/`)** — pure pipelines (like `visit-handler.ts`), injected nothing beyond env:
- `online-connect-handler.ts` `handleOnlineConnect(env, form, ip)` → zod (name, email, location?) → Turnstile → `createOnlineAttendance` → `notifyStaff` → 303.
- `prayer-handler.ts` `handlePrayer(env, form, ip)` → zod (name?, email?, request required, is_private coerce) → Turnstile → `createPrayerRequest` → `notifyStaff` → 303.

**Data access (`src/lib/db/`)** — `online-attendances.ts` (`createOnlineAttendance`, `listOnlineAttendances`), `prayer-requests.ts` (`createPrayerRequest`, `listPrayerRequests`). Schemas in `schemas.ts` (`OnlineConnectInputSchema`, `PrayerInputSchema`).

**Routes/pages:**
- `src/pages/live.astro` — loads settings + `home.gathering_schedule` (content) → `computeLiveStatus` → renders Live or Offline layout. Live: `toLiveEmbed` stream + chat iframe (if enabled & chatUrl) + connect card + Give/Prayer + bulletin. Offline: countdown to `next` + latest sermon ("Catch the last message") + schedule + connect + bulletin + Give/Prayer. Uses `PageHero`/`SectionIntro` styling.
- `src/pages/api/live/status.ts` — `GET` → JSON `{ isLive, endsAt?, next? }` (+ a cache-control: no-store).
- `src/pages/api/forms/online-connect.ts`, `src/pages/api/forms/prayer.ts` — `POST` → handler (read IP from `cf-connecting-ip`; Astro CSRF needs Origin → browsers send it).
- `src/pages/api/admin/live.ts` — gated `POST` → `setSettings` allowlisted to the live keys (+ "Go Live"/"End"/"Auto" just set `live_state`).
- `src/pages/admin/live.astro` — gated editor: stream URL, **state radio (Auto / Live now / Off)**, duration, tz offset, chat/connect toggles, bulletin title+body; plus recent **online attendances** and recent **prayer requests** tables.

**Nav:** add **Watch** → `/live` in `Nav.astro` links (and a Live badge when live is optional/deferred).

---

## 6. Data Flow

```
/live request → getAllSettings + getAllContent(gathering_schedule)
             → computeLiveStatus(schedule, dur, state, tzOffset, now)
   LIVE     → toLiveEmbed(stream_url, host) → render stream (+ chat) + connect/give/prayer/bulletin
   OFFLINE  → countdown to next window + latest sermon + schedule + connect/give/prayer/bulletin
client       → poll GET /api/live/status every 30s → reload when isLive flips
connect/prayer submit → handler (zod → Turnstile → insert → notify) → 303 back with ?ok=1
admin save   → /api/admin/live (gated) → setSettings(live keys)  | "Go Live" = live_state:'live'
```

## 7. Error Handling / Safety

- **No stream URL / unparseable** → Live layout shows a graceful "the stream will appear here shortly" placeholder (never a broken iframe); status logic still works.
- **DB/settings failure** on `/live` → defaults (offline, empty bulletin) so the page renders, never 500s.
- **Bad/empty schedule JSON** → `computeLiveStatus` treats it as no windows → offline (override still works); parse guarded.
- **Form validation / Turnstile failure** → 303 back with an error flag; no insert.
- **/api/live/status** never throws → returns `{ isLive:false }` on any error (page just stays offline).
- Chat iframe only rendered when `live_chat_enabled` AND a `chatUrl` exists.

## 8. Security

- Admin Live editor + save gated by `requireAdmin` + Cloudflare Access; live keys allowlisted.
- Public forms protected by Turnstile + Astro CSRF (Origin), IP from `cf-connecting-ip`; no PII in logs.
- Embeds: only same-shape provider URLs become iframes; the generic fallback sets the iframe `src` to the admin-entered URL (admin-trusted) — acceptable since only staff set it (behind Access). `embed_domain` uses the request host.
- Prayer requests default **private** (staff-only); no public exposure in this phase.

## 9. Testing Strategy

**Pure unit tests:**
- `status.ts`: inside a window → live; outside → offline with correct `next`; `state:'live'`/`'off'` override; empty/garbage schedule → offline; tz offset shifts the window.
- `embed.ts`: YouTube video → embed + chat URLs (with embed_domain); youtu.be/live forms; channel-live pass-through (no chat); vimeo; generic URL → raw iframe; junk → nulls.
- handlers: invalid input / failed Turnstile rejected pre-insert; valid → insert + redirect (Turnstile via injected fetch like the existing visit/register tests).

**D1 (Miniflare) tests:** `online_attendances` + `prayer_requests` create/list.

**Manual/dev:** set a schedule window around "now" → `/live` shows the stream area; set `live_state=live` → forces live; submit connect + prayer → appear in Admin → Live; poll endpoint returns correct JSON.

## 10. Rollout
1. Build + tests green.
2. Apply the two migrations (online_attendances, prayer_requests) local + remote.
3. Deploy. Defaults: `live_state=auto`, no stream URL yet → `/live` shows the offline hub (countdown + latest sermon). Staff add a stream URL + bulletin in Admin → Live; "Go Live" forces live for a one-off.

## 11. Open Questions (resolved defaults)
- Church time via a fixed `live_tz_offset_min` (default 0 = Accra/UTC); full IANA/DST deferred (Ghana has none).
- Stream URL stored in settings; primarily YouTube; channel-live supported (no chat); generic iframe fallback.
- Prayer is private capture only here; public wall + team workflow = Community phase.
- Client keeps the page fresh by polling `/api/live/status` and reloading on change (no realtime infra).
