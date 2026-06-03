import type { FundInput } from './schemas';
import { slugify, uniqueSlug } from '../slug';

export interface Fund {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: number;
}
export interface FundFull extends Fund {
  updated_by: string | null;
}

const COLS = 'id, name, slug, description, sort_order, active';

export async function listActiveFunds(db: D1Database): Promise<Fund[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM funds WHERE active = 1 ORDER BY sort_order ASC, name ASC`)
    .all<Fund>();
  return results;
}

export async function listAllFunds(db: D1Database): Promise<Fund[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM funds ORDER BY sort_order ASC, name ASC`).all<Fund>();
  return results;
}

export async function getFundById(db: D1Database, id: number): Promise<FundFull | null> {
  const row = await db.prepare(`SELECT ${COLS}, updated_by FROM funds WHERE id = ?`).bind(id).first<FundFull>();
  return row ?? null;
}

async function resolveSlug(db: D1Database, desired: string, name: string, excludeId?: number): Promise<string> {
  const base = slugify(desired || name);
  const exists = async (s: string) => {
    const row = await db.prepare('SELECT id FROM funds WHERE slug = ?').bind(s).first<{ id: number }>();
    return row != null && row.id !== excludeId;
  };
  return uniqueSlug(exists, base);
}

export async function createFund(db: D1Database, input: FundInput, email: string): Promise<number> {
  const slug = await resolveSlug(db, input.slug ?? '', input.name);
  const r = await db
    .prepare(`INSERT INTO funds (name, slug, description, sort_order, active, updated_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(input.name, slug, input.description || null, input.sort_order, input.active ? 1 : 0, email)
    .run();
  return Number(r.meta.last_row_id);
}

export async function updateFund(db: D1Database, id: number, input: FundInput, email: string): Promise<void> {
  const slug = await resolveSlug(db, input.slug ?? '', input.name, id);
  await db
    .prepare(
      `UPDATE funds SET name=?, slug=?, description=?, sort_order=?, active=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(input.name, slug, input.description || null, input.sort_order, input.active ? 1 : 0, email, id)
    .run();
}

export async function setFundActive(db: D1Database, id: number, active: boolean): Promise<void> {
  await db.prepare("UPDATE funds SET active=?, updated_at=datetime('now') WHERE id=?").bind(active ? 1 : 0, id).run();
}

export async function deleteFund(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM funds WHERE id = ?').bind(id).run();
}
