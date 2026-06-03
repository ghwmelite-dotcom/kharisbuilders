export interface AdminCounts {
  sermons: number;
  events: number;
  ministries: number;
  visitors: number;
  registrations: number;
}

export async function getCounts(db: D1Database): Promise<AdminCounts> {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM sermons) AS sermons,
        (SELECT COUNT(*) FROM events) AS events,
        (SELECT COUNT(*) FROM ministries) AS ministries,
        (SELECT COUNT(*) FROM visitors) AS visitors,
        (SELECT COUNT(*) FROM event_registrations) AS registrations`,
    )
    .first<AdminCounts>();
  return row ?? { sermons: 0, events: 0, ministries: 0, visitors: 0, registrations: 0 };
}

export interface AdminSermonRow {
  id: number;
  title: string;
  slug: string;
  speaker: string | null;
  sermon_date: string | null;
  published: number;
}
export async function listAllSermons(db: D1Database): Promise<AdminSermonRow[]> {
  const { results } = await db
    .prepare('SELECT id, title, slug, speaker, sermon_date, published FROM sermons ORDER BY sermon_date DESC, id DESC')
    .all<AdminSermonRow>();
  return results;
}

export interface AdminEventRow {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  start_at: string;
  registration_enabled: number;
  published: number;
}
export async function listAllEvents(db: D1Database): Promise<AdminEventRow[]> {
  const { results } = await db
    .prepare(
      'SELECT id, title, slug, category, start_at, registration_enabled, published FROM events ORDER BY start_at DESC',
    )
    .all<AdminEventRow>();
  return results;
}

export interface AdminMinistryRow {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  published: number;
}
export async function listAllMinistries(db: D1Database): Promise<AdminMinistryRow[]> {
  const { results } = await db
    .prepare('SELECT id, name, slug, sort_order, published FROM ministries ORDER BY sort_order ASC, name ASC')
    .all<AdminMinistryRow>();
  return results;
}

export interface AdminVisitorRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  visiting_service: string | null;
  status: string;
  created_at: string;
}
export async function listVisitors(db: D1Database): Promise<AdminVisitorRow[]> {
  const { results } = await db
    .prepare(
      'SELECT id, name, email, phone, visiting_service, status, created_at FROM visitors ORDER BY created_at DESC, id DESC',
    )
    .all<AdminVisitorRow>();
  return results;
}
