export interface ScheduleEntry {
  day: number; // 0=Sun .. 6=Sat
  hour: number;
  min?: number;
  label: string;
}
export interface LiveStatus {
  isLive: boolean;
  endsAtMs?: number;
  next?: { label: string; atMs: number };
}

const WEEK = 10080; // minutes in a week
const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Decide whether the church is live now, from the manual state, the weekly schedule, and the
 * church-local time (now shifted by tzOffsetMin). Returns the end time when live, or the next
 * window's start when offline.
 */
export function computeLiveStatus(
  schedule: ScheduleEntry[],
  durationMin: number,
  state: string,
  tzOffsetMin: number,
  now: Date,
): LiveStatus {
  if (state === 'live') return { isLive: true };
  const nowMs = now.getTime();
  const church = new Date(nowMs + tzOffsetMin * 60000); // shift so UTC getters read church-local wall clock
  const mow = church.getUTCDay() * 1440 + church.getUTCHours() * 60 + church.getUTCMinutes();

  let bestUntil = Infinity;
  let next: { label: string; atMs: number } | undefined;
  for (const e of schedule) {
    if (!e || typeof e.day !== 'number' || typeof e.hour !== 'number') continue;
    const start = mod(e.day * 1440 + e.hour * 60 + (e.min ?? 0), WEEK);
    const into = mod(mow - start, WEEK);
    if (state === 'auto' && into < durationMin) {
      return { isLive: true, endsAtMs: nowMs + (durationMin - into) * 60000 };
    }
    const until = mod(start - mow, WEEK);
    if (until < bestUntil) {
      bestUntil = until;
      next = { label: e.label, atMs: nowMs + until * 60000 };
    }
  }
  return { isLive: false, next };
}
