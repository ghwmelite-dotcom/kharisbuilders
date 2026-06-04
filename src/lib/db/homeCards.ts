import type { HomeCardInput } from './schemas';

export interface HomeCard {
  id: number;
  eyebrow: string | null;
  title: string;
  description: string | null;
  href: string;
  image_key: string | null;
  sort_order: number;
}

const COLS = 'id, eyebrow, title, description, href, image_key, sort_order';

export async function listHomeCards(db: D1Database): Promise<HomeCard[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM home_cards ORDER BY sort_order ASC, id ASC`).all<HomeCard>();
  return results;
}
export async function getHomeCardById(db: D1Database, id: number): Promise<HomeCard | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM home_cards WHERE id = ?`).bind(id).first<HomeCard>();
  return row ?? null;
}
export async function createHomeCard(db: D1Database, input: HomeCardInput, email: string): Promise<number> {
  const r = await db
    .prepare('INSERT INTO home_cards (eyebrow, title, description, href, sort_order, updated_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(input.eyebrow || null, input.title, input.description || null, input.href, input.sort_order, email)
    .run();
  return Number(r.meta.last_row_id);
}
export async function updateHomeCard(db: D1Database, id: number, input: HomeCardInput, email: string): Promise<void> {
  await db
    .prepare(
      "UPDATE home_cards SET eyebrow=?, title=?, description=?, href=?, sort_order=?, updated_by=?, updated_at=datetime('now') WHERE id=?",
    )
    .bind(input.eyebrow || null, input.title, input.description || null, input.href, input.sort_order, email, id)
    .run();
}
export async function setHomeCardImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE home_cards SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
export async function deleteHomeCard(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM home_cards WHERE id = ?').bind(id).run();
}
