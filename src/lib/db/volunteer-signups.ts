export type VolunteerSignupStatus = 'new' | 'contacted' | 'done';

export interface VolunteerSignup {
  id: number;
  role_id: number | null;
  role_name: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

export async function createVolunteerSignup(
  db: D1Database,
  input: { role_id: number; role_name: string; name: string; email: string; phone: string; message: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO volunteer_signups (role_id, role_name, name, email, phone, message) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(input.role_id, input.role_name, input.name, input.email, input.phone || null, input.message || null)
    .run();
}

export async function listVolunteerSignups(db: D1Database, limit = 200): Promise<VolunteerSignup[]> {
  const { results } = await db
    .prepare(
      'SELECT id, role_id, role_name, name, email, phone, message, status, created_at FROM volunteer_signups ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all<VolunteerSignup>();
  return results;
}

export async function setVolunteerSignupStatus(db: D1Database, id: number, status: VolunteerSignupStatus): Promise<void> {
  await db.prepare('UPDATE volunteer_signups SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deleteVolunteerSignup(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM volunteer_signups WHERE id = ?').bind(id).run();
}
