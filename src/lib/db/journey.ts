import type { JourneyInput } from './schemas';

export interface Journey {
  id: number;
  year: string;
  title: string;
  body: string | null;
  image_key: string | null;
  sort_order: number;
}

const COLS = 'id, year, title, body, image_key, sort_order';

export async function listJourney(db: D1Database): Promise<Journey[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM journey ORDER BY sort_order ASC, id ASC`).all<Journey>();
  return results;
}
export async function getJourneyById(db: D1Database, id: number): Promise<Journey | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM journey WHERE id = ?`).bind(id).first<Journey>();
  return row ?? null;
}
export async function createJourney(db: D1Database, input: JourneyInput, email: string): Promise<number> {
  const r = await db
    .prepare('INSERT INTO journey (year, title, body, sort_order, updated_by) VALUES (?, ?, ?, ?, ?)')
    .bind(input.year, input.title, input.body || null, input.sort_order, email)
    .run();
  return Number(r.meta.last_row_id);
}
export async function updateJourney(db: D1Database, id: number, input: JourneyInput, email: string): Promise<void> {
  await db
    .prepare("UPDATE journey SET year=?, title=?, body=?, sort_order=?, updated_by=?, updated_at=datetime('now') WHERE id=?")
    .bind(input.year, input.title, input.body || null, input.sort_order, email, id)
    .run();
}
export async function setJourneyImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE journey SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
export async function deleteJourney(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM journey WHERE id = ?').bind(id).run();
}
