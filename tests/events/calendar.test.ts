import { describe, it, expect } from 'vitest';
import { toIcsUtc, icsEscape, buildIcs, googleCalendarUrl } from '../../src/lib/events/calendar';
import type { EventRow } from '../../src/lib/db/events';

const ev = (over: Partial<EventRow> = {}): EventRow => ({
  id: 1,
  title: 'Summer Conference',
  slug: 'summer-conference',
  category: 'Conference',
  description: 'A great time.',
  start_at: '2026-07-01T18:00',
  end_at: '2026-07-01T20:30',
  location: 'Main Hall',
  image_key: null,
  registration_enabled: 1,
  capacity: 100,
  ...over,
});

describe('toIcsUtc', () => {
  it('converts naive local time to UTC using the offset', () => {
    expect(toIcsUtc('2026-07-01T18:00', 0)).toBe('20260701T180000Z');
    expect(toIcsUtc('2026-07-01T18:00', 60)).toBe('20260701T170000Z'); // local is +60min ahead of UTC
    expect(toIcsUtc('2026-07-01T18:00:45', 0)).toBe('20260701T180045Z'); // tolerates seconds
  });
});

describe('icsEscape', () => {
  it('escapes commas, semicolons, backslashes, and newlines', () => {
    expect(icsEscape('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });
});

describe('buildIcs', () => {
  it('builds a valid VEVENT with escaped fields and a stable UID', () => {
    const out = buildIcs(ev({ title: 'Praise, Worship\nNight' }), 'https://church.example', 0);
    expect(out).toContain('BEGIN:VCALENDAR');
    expect(out).toContain('BEGIN:VEVENT');
    expect(out).toContain('UID:event-1@church.example');
    expect(out).toContain('DTSTART:20260701T180000Z');
    expect(out).toContain('DTEND:20260701T203000Z');
    expect(out).toContain('SUMMARY:Praise\\, Worship\\nNight');
    expect(out).toContain('URL:https://church.example/events/summer-conference');
    expect(out).toContain('END:VCALENDAR');
  });
  it('defaults DTEND to start + 2h when end_at is null', () => {
    const out = buildIcs(ev({ end_at: null }), 'https://church.example', 0);
    expect(out).toContain('DTSTART:20260701T180000Z');
    expect(out).toContain('DTEND:20260701T200000Z');
  });
});

describe('googleCalendarUrl', () => {
  it('builds a render URL with UTC dates and the title', () => {
    const url = googleCalendarUrl(ev(), 'https://church.example', 0);
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(url).toContain('dates=');
    expect(url).toContain('20260701T180000Z');
    expect(url).toContain('20260701T203000Z');
    expect(url).toContain('text=Summer+Conference');
  });
});
