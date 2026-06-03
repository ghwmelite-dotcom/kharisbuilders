import type { RegistrationInput } from './schemas';

export async function createRegistration(db: D1Database, input: RegistrationInput): Promise<number> {
  const result = await db
    .prepare('INSERT INTO event_registrations (event_id, name, email, phone, guests) VALUES (?, ?, ?, ?, ?)')
    .bind(input.event_id, input.name, input.email, input.phone || null, input.guests)
    .run();
  return Number(result.meta.last_row_id);
}

/** Total seats taken for an event: one per registrant plus their guests. */
export async function countRegistrations(db: D1Database, eventId: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) + COALESCE(SUM(guests), 0) AS taken FROM event_registrations WHERE event_id = ?')
    .bind(eventId)
    .first<{ taken: number }>();
  return Number(row?.taken ?? 0);
}

export interface RegistrationRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  guests: number;
  created_at: string;
}

export async function listRegistrationsForEvent(db: D1Database, eventId: number): Promise<RegistrationRow[]> {
  const { results } = await db
    .prepare(
      'SELECT id, name, email, phone, guests, created_at FROM event_registrations WHERE event_id = ? ORDER BY created_at ASC, id ASC',
    )
    .bind(eventId)
    .all<RegistrationRow>();
  return results;
}
