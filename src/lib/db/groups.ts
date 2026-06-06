import type { GroupInput } from './schemas';

export interface Group {
  id: number;
  name: string;
  description: string | null;
  day: string | null;
  time: string | null;
  location: string | null;
  format: string;
  audience: string;
  leader: string | null;
  image_key: string | null;
  sort_order: number;
}
export interface GroupFull extends Group {
  published: number;
  updated_by: string | null;
}

const COLS = 'id, name, description, day, time, location, format, audience, leader, image_key, sort_order';

export async function listPublishedGroups(db: D1Database): Promise<Group[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM groups WHERE published = 1 ORDER BY sort_order ASC, name ASC`)
    .all<Group>();
  return results;
}
export async function listAllGroups(db: D1Database): Promise<GroupFull[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM groups ORDER BY sort_order ASC, name ASC`)
    .all<GroupFull>();
  return results;
}
export async function getGroupById(db: D1Database, id: number): Promise<GroupFull | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM groups WHERE id = ?`)
    .bind(id)
    .first<GroupFull>();
  return row ?? null;
}
export async function createGroup(db: D1Database, input: GroupInput, email: string): Promise<number> {
  const r = await db
    .prepare(
      `INSERT INTO groups (name, description, day, time, location, format, audience, leader, sort_order, published, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.name,
      input.description || null,
      input.day || null,
      input.time || null,
      input.location || null,
      input.format,
      input.audience,
      input.leader || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}
export async function updateGroup(db: D1Database, id: number, input: GroupInput, email: string): Promise<void> {
  await db
    .prepare(
      `UPDATE groups SET name=?, description=?, day=?, time=?, location=?, format=?, audience=?, leader=?,
        sort_order=?, published=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.name,
      input.description || null,
      input.day || null,
      input.time || null,
      input.location || null,
      input.format,
      input.audience,
      input.leader || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
      id,
    )
    .run();
}
export async function setGroupPublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db.prepare("UPDATE groups SET published=?, updated_at=datetime('now') WHERE id=?").bind(published ? 1 : 0, id).run();
}
export async function deleteGroup(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
}
export async function setGroupImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE groups SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
