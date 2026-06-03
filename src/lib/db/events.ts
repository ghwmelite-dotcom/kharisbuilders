export interface EventRow {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  image_key: string | null;
  registration_enabled: number;
  capacity: number | null;
}

const COLS =
  'id, title, slug, category, description, start_at, end_at, location, image_key, registration_enabled, capacity';

export async function listUpcomingEvents(db: D1Database, limit = 50): Promise<EventRow[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM events
       WHERE published = 1 AND start_at >= datetime('now')
       ORDER BY start_at ASC LIMIT ?`,
    )
    .bind(limit)
    .all<EventRow>();
  return results;
}

export async function getEventBySlug(db: D1Database, slug: string): Promise<EventRow | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM events WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<EventRow>();
  return row ?? null;
}
