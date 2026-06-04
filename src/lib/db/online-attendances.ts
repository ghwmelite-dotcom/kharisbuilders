import type { OnlineConnectInput } from './schemas';

export interface OnlineAttendance {
  id: number;
  name: string;
  email: string;
  location: string | null;
  created_at: string;
}

export async function createOnlineAttendance(db: D1Database, input: OnlineConnectInput): Promise<void> {
  await db
    .prepare('INSERT INTO online_attendances (name, email, location) VALUES (?, ?, ?)')
    .bind(input.name, input.email, input.location || null)
    .run();
}

export async function listOnlineAttendances(db: D1Database, limit = 100): Promise<OnlineAttendance[]> {
  const { results } = await db
    .prepare('SELECT id, name, email, location, created_at FROM online_attendances ORDER BY id DESC LIMIT ?')
    .bind(limit)
    .all<OnlineAttendance>();
  return results;
}
