export type GroupInterestStatus = 'new' | 'contacted' | 'done';

export interface GroupInterest {
  id: number;
  group_id: number | null;
  group_name: string | null;
  name: string;
  email: string;
  message: string | null;
  status: string;
  created_at: string;
}

export async function createGroupInterest(
  db: D1Database,
  input: { group_id: number; group_name: string; name: string; email: string; message: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO group_interests (group_id, group_name, name, email, message) VALUES (?, ?, ?, ?, ?)')
    .bind(input.group_id, input.group_name, input.name, input.email, input.message || null)
    .run();
}

export async function listGroupInterests(db: D1Database, limit = 200): Promise<GroupInterest[]> {
  const { results } = await db
    .prepare(
      'SELECT id, group_id, group_name, name, email, message, status, created_at FROM group_interests ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all<GroupInterest>();
  return results;
}

export async function setGroupInterestStatus(db: D1Database, id: number, status: GroupInterestStatus): Promise<void> {
  await db.prepare('UPDATE group_interests SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deleteGroupInterest(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM group_interests WHERE id = ?').bind(id).run();
}
