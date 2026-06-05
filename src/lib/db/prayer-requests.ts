import type { PrayerInput } from './schemas';

export interface PrayerRequest {
  id: number;
  name: string | null;
  email: string | null;
  request: string;
  is_private: number;
  status: string;
  pray_count: number;
  created_at: string;
}

/** Public-safe shape — no email, no status. */
export interface PublicPrayer {
  id: number;
  name: string | null;
  request: string;
  pray_count: number;
  created_at: string;
}

export type PrayerStatus = 'new' | 'approved' | 'hidden';

export async function createPrayerRequest(db: D1Database, input: PrayerInput): Promise<void> {
  await db
    .prepare('INSERT INTO prayer_requests (name, email, request, is_private) VALUES (?, ?, ?, ?)')
    .bind(input.name || null, input.email || null, input.request, input.is_private ? 1 : 0)
    .run();
}

/** Admin: every request, newest first. */
export async function listPrayerRequests(db: D1Database, limit = 100): Promise<PrayerRequest[]> {
  const { results } = await db
    .prepare(
      'SELECT id, name, email, request, is_private, status, pray_count, created_at FROM prayer_requests ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all<PrayerRequest>();
  return results;
}

/** Public wall: approved + public only, no email. */
export async function listPublicPrayers(db: D1Database, limit = 60): Promise<PublicPrayer[]> {
  const { results } = await db
    .prepare(
      "SELECT id, name, request, pray_count, created_at FROM prayer_requests WHERE is_private = 0 AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(limit)
    .all<PublicPrayer>();
  return results;
}

/** Increment a wall request's counter. Only affects approved-public rows. Returns the new count (0 if ineligible). */
export async function incrementPrayCount(db: D1Database, id: number): Promise<number> {
  await db
    .prepare(
      "UPDATE prayer_requests SET pray_count = pray_count + 1 WHERE id = ? AND is_private = 0 AND status = 'approved'",
    )
    .bind(id)
    .run();
  const row = await db
    .prepare("SELECT pray_count FROM prayer_requests WHERE id = ? AND is_private = 0 AND status = 'approved'")
    .bind(id)
    .first<{ pray_count: number }>();
  return row?.pray_count ?? 0;
}

export async function setPrayerStatus(db: D1Database, id: number, status: PrayerStatus): Promise<void> {
  await db.prepare('UPDATE prayer_requests SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deletePrayerRequest(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM prayer_requests WHERE id = ?').bind(id).run();
}
