import { describe, it, expect } from 'vitest';
import { computeLiveStatus, type ScheduleEntry } from '../../src/lib/live/status';

// 2026-06-07 and 2026-06-14 are Sundays (day 0). tzOffset 0 = Accra/UTC.
const sched: ScheduleEntry[] = [{ day: 0, hour: 9, min: 0, label: 'Sunday · 9:00 AM' }];

describe('computeLiveStatus', () => {
  it('state=live forces live', () => {
    expect(computeLiveStatus([], 90, 'live', 0, new Date('2026-06-03T00:00:00Z')).isLive).toBe(true);
  });
  it('state=off forces offline (still computes next)', () => {
    const r = computeLiveStatus(sched, 90, 'off', 0, new Date('2026-06-07T09:30:00Z'));
    expect(r.isLive).toBe(false);
    expect(r.next?.label).toBe('Sunday · 9:00 AM');
  });
  it('auto: inside the window is live with an end time', () => {
    const r = computeLiveStatus(sched, 90, 'auto', 0, new Date('2026-06-07T09:30:00Z')); // 30min into a 90min window
    expect(r.isLive).toBe(true);
    expect(r.endsAtMs).toBe(new Date('2026-06-07T10:30:00Z').getTime());
  });
  it('auto: outside the window is offline with the next start', () => {
    const r = computeLiveStatus(sched, 90, 'auto', 0, new Date('2026-06-07T12:00:00Z'));
    expect(r.isLive).toBe(false);
    expect(r.next?.atMs).toBe(new Date('2026-06-14T09:00:00Z').getTime()); // next Sunday
  });
  it('tz offset shifts the window (church UTC+1)', () => {
    // 08:30 UTC == 09:30 church (offset +60) => inside the 9am window
    expect(computeLiveStatus(sched, 90, 'auto', 60, new Date('2026-06-07T08:30:00Z')).isLive).toBe(true);
  });
  it('empty/garbage schedule -> offline', () => {
    expect(computeLiveStatus([], 90, 'auto', 0, new Date()).isLive).toBe(false);
  });
});
