import type { MinistryInput } from './schemas';
import { slugify, uniqueSlug } from '../slug';

export interface Ministry {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_key: string | null;
  leader: string | null;
  meeting_time: string | null;
  sort_order: number;
}

export interface MinistryFull extends Ministry {
  published: number;
  updated_by: string | null;
}

export async function listPublishedMinistries(db: D1Database): Promise<Ministry[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, slug, description, image_key, leader, meeting_time, sort_order
       FROM ministries WHERE published = 1 ORDER BY sort_order ASC, name ASC`,
    )
    .all<Ministry>();
  return results;
}

export async function getMinistryById(db: D1Database, id: number): Promise<MinistryFull | null> {
  const row = await db
    .prepare(
      `SELECT id, name, slug, description, image_key, leader, meeting_time, sort_order, published, updated_by
       FROM ministries WHERE id = ?`,
    )
    .bind(id)
    .first<MinistryFull>();
  return row ?? null;
}

async function resolveSlug(db: D1Database, desired: string, name: string, excludeId?: number): Promise<string> {
  const base = slugify(desired || name);
  const exists = async (s: string) => {
    const row = await db.prepare('SELECT id FROM ministries WHERE slug = ?').bind(s).first<{ id: number }>();
    return row != null && row.id !== excludeId;
  };
  return uniqueSlug(exists, base);
}

export async function createMinistry(db: D1Database, input: MinistryInput, email: string): Promise<number> {
  const slug = await resolveSlug(db, input.slug ?? '', input.name);
  const r = await db
    .prepare(
      `INSERT INTO ministries (name, slug, description, leader, meeting_time, sort_order, published, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.name,
      slug,
      input.description,
      input.leader || null,
      input.meeting_time || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}

export async function updateMinistry(db: D1Database, id: number, input: MinistryInput, email: string): Promise<void> {
  const slug = await resolveSlug(db, input.slug ?? '', input.name, id);
  await db
    .prepare(
      `UPDATE ministries SET name=?, slug=?, description=?, leader=?, meeting_time=?, sort_order=?,
        published=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.name,
      slug,
      input.description,
      input.leader || null,
      input.meeting_time || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
      id,
    )
    .run();
}

export async function setMinistryPublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db
    .prepare("UPDATE ministries SET published=?, updated_at=datetime('now') WHERE id=?")
    .bind(published ? 1 : 0, id)
    .run();
}

export async function deleteMinistry(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM ministries WHERE id = ?').bind(id).run();
}
