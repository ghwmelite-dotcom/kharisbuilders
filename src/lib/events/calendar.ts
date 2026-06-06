import type { EventRow } from '../db/events';

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours when no end_at

/** Parse a naive "YYYY-MM-DDTHH:MM(:SS)?" local wall-clock string into a UTC instant (ms). */
function toUtcMs(naive: string, tzOffsetMin: number): number {
  const m = naive.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0) - tzOffsetMin * 60000;
}

function fmtUtc(ms: number): string {
  const dt = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}T${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}${p(dt.getUTCSeconds())}Z`;
}

/** Naive local datetime -> "YYYYMMDDTHHMMSSZ" (UTC). */
export function toIcsUtc(naive: string, tzOffsetMin: number): string {
  return fmtUtc(toUtcMs(naive, tzOffsetMin));
}

/** RFC-5545 text escaping. */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function startEndUtc(event: EventRow, tzOffsetMin: number): { start: string; end: string } {
  const startMs = toUtcMs(event.start_at, tzOffsetMin);
  const endMs = event.end_at ? toUtcMs(event.end_at, tzOffsetMin) : startMs + DEFAULT_DURATION_MS;
  return { start: fmtUtc(startMs), end: fmtUtc(endMs) };
}

/** Build a single-event VCALENDAR string (CRLF line endings). */
export function buildIcs(event: EventRow, origin: string, tzOffsetMin: number): string {
  const host = new URL(origin).host;
  const { start, end } = startEndUtc(event, tzOffsetMin);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${host}//Events//EN`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:event-${event.id}@${host}`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description ?? '')}`,
    `LOCATION:${icsEscape(event.location ?? '')}`,
    `URL:${origin}/events/${event.slug}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** Build a Google Calendar "render" template URL with UTC dates. */
export function googleCalendarUrl(event: EventRow, origin: string, tzOffsetMin: number): string {
  const { start, end } = startEndUtc(event, tzOffsetMin);
  const eventUrl = `${origin}/events/${event.slug}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: `${event.description ?? ''}\n\n${eventUrl}`.trim(),
    location: event.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
