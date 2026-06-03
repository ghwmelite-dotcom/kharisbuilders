import type { EventInput } from './schemas';
import { slugify, uniqueSlug } from '../slug';

export interface EventRow {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  image_key: string | null;
  registration_enabled: number;
  capacity: number | null;
}

export interface EventFull extends EventRow {
  published: number;
  updated_by: string | null;
}

const COLS =
  'id, title, slug, category, description, start_at, end_at, location, image_key, registration_enabled, capacity';

export async function listUpcomingEvents(db: D1Database, limit = 50): Promise<EventRow[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM events
       WHERE published = 1 AND start_at >= datetime('now')
       ORDER BY start_at ASC LIMIT ?`,
    )
    .bind(limit)
    .all<EventRow>();
  return results;
}

export async function getEventBySlug(db: D1Database, slug: string): Promise<EventRow | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM events WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<EventRow>();
  return row ?? null;
}

export interface EventForRegistration {
  id: number;
  slug: string;
  published: number;
  registration_enabled: number;
  capacity: number | null;
}

/** Minimal event fields the registration handler needs to validate a submission. */
export async function getEventForRegistration(db: D1Database, id: number): Promise<EventForRegistration | null> {
  const row = await db
    .prepare('SELECT id, slug, published, registration_enabled, capacity FROM events WHERE id = ?')
    .bind(id)
    .first<EventForRegistration>();
  return row ?? null;
}

export async function getEventById(db: D1Database, id: number): Promise<EventFull | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM events WHERE id = ?`)
    .bind(id)
    .first<EventFull>();
  return row ?? null;
}

async function resolveSlug(db: D1Database, desired: string, title: string, excludeId?: number): Promise<string> {
  const base = slugify(desired || title);
  const exists = async (s: string) => {
    const row = await db.prepare('SELECT id FROM events WHERE slug = ?').bind(s).first<{ id: number }>();
    return row != null && row.id !== excludeId;
  };
  return uniqueSlug(exists, base);
}

export async function createEvent(db: D1Database, input: EventInput, email: string): Promise<number> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title);
  const r = await db
    .prepare(
      `INSERT INTO events (title, slug, category, description, start_at, end_at, location, registration_enabled, capacity, published, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.title,
      slug,
      input.category || null,
      input.description || null,
      input.start_at,
      input.end_at || null,
      input.location || null,
      input.registration_enabled ? 1 : 0,
      input.capacity ?? null,
      input.published ? 1 : 0,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}

export async function updateEvent(db: D1Database, id: number, input: EventInput, email: string): Promise<void> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title, id);
  await db
    .prepare(
      `UPDATE events SET title=?, slug=?, category=?, description=?, start_at=?, end_at=?, location=?,
        registration_enabled=?, capacity=?, published=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.title,
      slug,
      input.category || null,
      input.description || null,
      input.start_at,
      input.end_at || null,
      input.location || null,
      input.registration_enabled ? 1 : 0,
      input.capacity ?? null,
      input.published ? 1 : 0,
      email,
      id,
    )
    .run();
}

export async function setEventPublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db
    .prepare("UPDATE events SET published=?, updated_at=datetime('now') WHERE id=?")
    .bind(published ? 1 : 0, id)
    .run();
}

export async function deleteEvent(db: D1Database, id: number): Promise<void> {
  // Remove child registrations first — D1 enforces the FK, so deleting the parent
  // while registrations exist would fail.
  await db.batch([
    db.prepare('DELETE FROM event_registrations WHERE event_id = ?').bind(id),
    db.prepare('DELETE FROM events WHERE id = ?').bind(id),
  ]);
}
