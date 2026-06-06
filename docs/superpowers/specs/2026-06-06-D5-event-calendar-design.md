# D5 — Event "Add to Calendar" (.ics + Google) + Spots-Left Design

**Date:** 2026-06-06
**Roadmap:** D (Community & Care), final sub-project D5. Follows D1 (prayer wall), D2 (connect), D3 (groups), D4 (volunteer signups).
**Status:** Approved — ready for implementation plan.

## Purpose

Event RSVP/registration already exists in full (`event_registrations` table, `register-handler.ts`, `registrations.ts`, capacity + guests, admin registrations view). D5 makes events **savable to a personal calendar** and shows **remaining capacity**. Two visitor-facing wins:

1. **Add to Calendar** — a downloadable `.ics` file per event plus a Google Calendar link, on every event detail page (registration not required) and inside the post-registration confirmation.
2. **Spots left** — show remaining capacity ("12 spots left") instead of only a binary full/not-full message.

This is deliberately small: no new tables, no admin surface, no new feature flag. It builds on the existing `events` feature.

## Scope

**In scope:** a pure calendar module (`.ics` + Google URL builders with correct timezone anchoring), one `.ics` GET endpoint, and edits to the event detail page (calendar buttons in two places + spots-left).

**Out of scope (YAGNI):** recurring events (RRULE), calendar attachments emailed with the registration confirmation, per-attendee personalized invites (ORGANIZER/ATTENDEE), Outlook/Office deep links (the `.ics` download covers Apple/Outlook/everything else), iCal subscription feeds of all events.

## Timezone Decision

Events store `start_at` / `end_at` as naive datetime strings (e.g. `2026-07-01T18:00`), interpreted as the church's local wall-clock time. `CHURCH.timezoneOffsetMin` (minutes the local zone is ahead of UTC; Kharis = 0 / Accra) anchors them. The `.ics` and Google URLs emit **UTC** instants (`…Z`), computed as `localInstant − tzOffsetMin·60000`. This is correct for attendees in any zone and identity for Kharis. `Date.UTC` / `Date` are available in page/endpoint runtime and unit tests (this is not a workflow script).

## Components

### `src/lib/events/calendar.ts` (the whole testable core)

A focused, dependency-light module. Input type is the existing `EventRow` from `src/lib/db/events.ts` (has `id, title, slug, category, description, start_at, end_at, location, image_key`).

- `toIcsUtc(naive: string, tzOffsetMin: number): string` — parse `YYYY-MM-DDTHH:MM(:SS)?` into parts, build the instant with `Date.UTC(y, mo-1, d, h, mi, s)`, subtract `tzOffsetMin*60000`, and format the result as `YYYYMMDDTHHMMSSZ`.
- `icsEscape(text: string): string` — RFC-5545 escaping: backslash, comma, semicolon escaped with `\`; newlines → `\n`.
- `buildIcs(event: EventRow, origin: string, tzOffsetMin: number): string` — returns a `VCALENDAR` with one `VEVENT`, CRLF line endings:
  - `UID:event-<id>@<host>` where `<host>` is `new URL(origin).host` (stable, deterministic).
  - `DTSTAMP` = `DTSTART` (deterministic; avoids depending on "now").
  - `DTSTART:<toIcsUtc(start_at)>`; `DTEND:<toIcsUtc(end_at)>`, or start + 2 hours when `end_at` is null/empty.
  - `SUMMARY:<icsEscape(title)>`, `DESCRIPTION:<icsEscape(description ?? '')>`, `LOCATION:<icsEscape(location ?? '')>`, `URL:<origin>/events/<slug>`.
  - Standard headers: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//<host>//Events//EN`, `BEGIN:VEVENT` … `END:VEVENT`, `END:VCALENDAR`.
- `googleCalendarUrl(event: EventRow, origin: string, tzOffsetMin: number): string` — `https://calendar.google.com/calendar/render?action=TEMPLATE` with URL-encoded params: `text` (title), `dates=<start>Z-form/<end>Z-form` (the two `toIcsUtc` outputs joined by `/`), `details` (description + event URL), `location`.

### `src/pages/events/[slug].ics.ts` (endpoint)

A `GET` Astro endpoint producing the route `/events/<slug>.ics`.

- Guard: if `!feature('events')` → 404.
- Load `getEventBySlug(env.DB, slug)`; if missing → 404 (getEventBySlug already returns only published events; verify and rely on that).
- Build the body with `buildIcs(event, origin, CHURCH.timezoneOffsetMin)` where `origin = (Astro.site ?? new URL(SITE.url)).origin`.
- Return `new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="<slug>.ics"' } })`.

### `src/pages/events/[slug].astro` (edits)

- Import `CHURCH` (for `timezoneOffsetMin`) and `googleCalendarUrl` from the new module; compute `gcalUrl` and the `.ics` href (`/events/<slug>.ics`).
- **Calendar block** (a small reusable markup snippet inline in the page): a "Download .ics" link and a "Google Calendar" link (`target="_blank" rel="noopener"`). Rendered:
  1. In the sidebar card, shown for all events (top of the card, above the registration block).
  2. Inside the `registered` confirmation branch, under "You're registered — see you there!".
- **Spots-left:** replace the current `isFull` boolean with `remaining` computed only when `registration_enabled && capacity != null`: `remaining = Math.max(0, capacity − count)`. When `remaining === 0` (or `fullParam`) show the existing full message; otherwise show "{remaining} spots left" above the form. When capacity is null, no count is shown (unlimited) — current behavior.

## Data Flow

1. Visitor opens `/events/<slug>` → page renders description, registration form (if enabled, with spots-left), and the Add-to-Calendar block.
2. Visitor clicks "Download .ics" → browser GETs `/events/<slug>.ics` → endpoint streams a `text/calendar` attachment → opens in Apple Calendar / Outlook / etc.
3. Visitor clicks "Google Calendar" → new tab to Google's pre-filled event template.
4. Visitor registers → existing flow → confirmation state now also shows the Add-to-Calendar block.

## Error Handling

- `.ics` endpoint: unknown/unpublished slug → 404; `events` feature off → 404. DB error → 404 (caught), so the route never 500s.
- Page: registration count failures already fall back safely; spots-left falls back to hiding the count (treats as not-full) on error, matching current behavior.
- `buildIcs` tolerates null `description`/`location`/`end_at` (defaults applied).

## Testing (TDD)

`tests/events/calendar.test.ts` (Vitest, pure — no DB):
1. `toIcsUtc` — `toIcsUtc('2026-07-01T18:00', 60)` → `'20260701T170000Z'` (subtracts an hour); `toIcsUtc('2026-07-01T18:00', 0)` → `'20260701T180000Z'`; tolerates a trailing `:00` seconds component.
2. `buildIcs` — contains `BEGIN:VCALENDAR`, `BEGIN:VEVENT`, `UID:event-1@`, a `DTSTART:…Z` line, `SUMMARY:`, `URL:https://…/events/<slug>`; defaults `DTEND` to start + 2h when `end_at` is null; a title containing a comma and a newline is escaped (`\,` and `\n` present, raw newline absent inside the property value).
3. `googleCalendarUrl` — starts with the Google render URL and contains `dates=` with two `Z`-suffixed UTC stamps separated by `%2F` or `/`, plus `text=`.

Pages and the endpoint are verified by `npx astro build`. Target ≈ 261 tests (258 + 3).

## Definition of Done

- `/events/<slug>.ics` returns a valid `text/calendar` attachment for a published event (404 otherwise); the file imports cleanly into a calendar app.
- The event detail page shows an Add-to-Calendar block (.ics + Google) for every event and again in the registered-confirmation state.
- When registration is enabled with a capacity, the page shows "N spots left" (0 → full message).
- `npx vitest run` green (~261); `npx astro build` passes.
- Merges to `main`; ships to Kharis (deploy; verify an event's `/events/<slug>.ics` returns `text/calendar`). No migrations needed.

## Next

D5 completes roadmap D (Community & Care). After this: the standing items are the live-Kharis AI reindex + Turnstile key check, the `docs/GO-LIVE.md` runbook (Phase 3), or roadmap phases F (member accounts) / G (PWA + push).
