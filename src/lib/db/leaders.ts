import type { LeaderInput } from './schemas';

export interface Leader {
  id: number;
  name: string;
  role: string | null;
  image_key: string | null;
  sort_order: number;
}

const COLS = 'id, name, role, image_key, sort_order';

export async function listLeaders(db: D1Database): Promise<Leader[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM leaders ORDER BY sort_order ASC, id ASC`).all<Leader>();
  return results;
}
export async function getLeaderById(db: D1Database, id: number): Promise<Leader | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM leaders WHERE id = ?`).bind(id).first<Leader>();
  return row ?? null;
}
export async function createLeader(db: D1Database, input: LeaderInput, email: string): Promise<number> {
  const r = await db
    .prepare('INSERT INTO leaders (name, role, sort_order, updated_by) VALUES (?, ?, ?, ?)')
    .bind(input.name, input.role || null, input.sort_order, email)
    .run();
  return Number(r.meta.last_row_id);
}
export async function updateLeader(db: D1Database, id: number, input: LeaderInput, email: string): Promise<void> {
  await db
    .prepare("UPDATE leaders SET name=?, role=?, sort_order=?, updated_by=?, updated_at=datetime('now') WHERE id=?")
    .bind(input.name, input.role || null, input.sort_order, email, id)
    .run();
}
export async function setLeaderImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE leaders SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
export async function deleteLeader(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM leaders WHERE id = ?').bind(id).run();
}
