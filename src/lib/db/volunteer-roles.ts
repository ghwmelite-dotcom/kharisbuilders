import type { VolunteerRoleInput } from './schemas';

export interface VolunteerRole {
  id: number;
  name: string;
  description: string | null;
  area: string;
  commitment: string;
  schedule: string | null;
  requirements: string | null;
  leader: string | null;
  image_key: string | null;
  sort_order: number;
}
export interface VolunteerRoleFull extends VolunteerRole {
  published: number;
  updated_by: string | null;
}

const COLS = 'id, name, description, area, commitment, schedule, requirements, leader, image_key, sort_order';

export async function listPublishedRoles(db: D1Database): Promise<VolunteerRole[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM volunteer_roles WHERE published = 1 ORDER BY sort_order ASC, name ASC`)
    .all<VolunteerRole>();
  return results;
}
export async function listAllRoles(db: D1Database): Promise<VolunteerRoleFull[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM volunteer_roles ORDER BY sort_order ASC, name ASC`)
    .all<VolunteerRoleFull>();
  return results;
}
export async function getRoleById(db: D1Database, id: number): Promise<VolunteerRoleFull | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM volunteer_roles WHERE id = ?`)
    .bind(id)
    .first<VolunteerRoleFull>();
  return row ?? null;
}
export async function createRole(db: D1Database, input: VolunteerRoleInput, email: string): Promise<number> {
  const r = await db
    .prepare(
      `INSERT INTO volunteer_roles (name, description, area, commitment, schedule, requirements, leader, sort_order, published, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.name,
      input.description || null,
      input.area,
      input.commitment,
      input.schedule || null,
      input.requirements || null,
      input.leader || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}
export async function updateRole(db: D1Database, id: number, input: VolunteerRoleInput, email: string): Promise<void> {
  await db
    .prepare(
      `UPDATE volunteer_roles SET name=?, description=?, area=?, commitment=?, schedule=?, requirements=?, leader=?,
        sort_order=?, published=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.name,
      input.description || null,
      input.area,
      input.commitment,
      input.schedule || null,
      input.requirements || null,
      input.leader || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
      id,
    )
    .run();
}
export async function setRolePublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db.prepare("UPDATE volunteer_roles SET published=?, updated_at=datetime('now') WHERE id=?").bind(published ? 1 : 0, id).run();
}
export async function deleteRole(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM volunteer_roles WHERE id = ?').bind(id).run();
}
export async function setRoleImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE volunteer_roles SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
