import type { PrayerInput } from './schemas';

export interface PrayerRequest {
  id: number;
  name: string | null;
  email: string | null;
  request: string;
  is_private: number;
  status: string;
  created_at: string;
}

export async function createPrayerRequest(db: D1Database, input: PrayerInput): Promise<void> {
  await db
    .prepare('INSERT INTO prayer_requests (name, email, request, is_private) VALUES (?, ?, ?, ?)')
    .bind(input.name || null, input.email || null, input.request, input.is_private ? 1 : 0)
    .run();
}

export async function listPrayerRequests(db: D1Database, limit = 100): Promise<PrayerRequest[]> {
  const { results } = await db
    .prepare('SELECT id, name, email, request, is_private, status, created_at FROM prayer_requests ORDER BY id DESC LIMIT ?')
    .bind(limit)
    .all<PrayerRequest>();
  return results;
}
