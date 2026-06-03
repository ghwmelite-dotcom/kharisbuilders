import type { VideoProvider } from '../video';
import type { SermonInput } from './schemas';
import { slugify, uniqueSlug } from '../slug';

export interface Sermon {
  id: number;
  title: string;
  slug: string;
  speaker: string | null;
  series: string | null;
  scripture_ref: string | null;
  video_url: string;
  video_provider: VideoProvider;
  thumbnail_key: string | null;
  description: string | null;
  sermon_date: string | null;
}

export interface SermonFull extends Sermon {
  published: number;
  updated_by: string | null;
}

const COLS =
  'id, title, slug, speaker, series, scripture_ref, video_url, video_provider, thumbnail_key, description, sermon_date';

export async function listPublishedSermons(db: D1Database, limit = 50): Promise<Sermon[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM sermons WHERE published = 1 ORDER BY sermon_date DESC, id DESC LIMIT ?`)
    .bind(limit)
    .all<Sermon>();
  return results;
}

export async function getSermonBySlug(db: D1Database, slug: string): Promise<Sermon | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM sermons WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<Sermon>();
  return row ?? null;
}

export async function getSermonById(db: D1Database, id: number): Promise<SermonFull | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM sermons WHERE id = ?`)
    .bind(id)
    .first<SermonFull>();
  return row ?? null;
}

async function resolveSlug(db: D1Database, desired: string, title: string, excludeId?: number): Promise<string> {
  const base = slugify(desired || title);
  const exists = async (s: string) => {
    const row = await db.prepare('SELECT id FROM sermons WHERE slug = ?').bind(s).first<{ id: number }>();
    return row != null && row.id !== excludeId;
  };
  return uniqueSlug(exists, base);
}

export async function createSermon(db: D1Database, input: SermonInput, email: string): Promise<number> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title);
  const r = await db
    .prepare(
      `INSERT INTO sermons (title, slug, speaker, series, scripture_ref, video_url, video_provider, description, sermon_date, published, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.title,
      slug,
      input.speaker || null,
      input.series || null,
      input.scripture_ref || null,
      input.video_url,
      input.video_provider,
      input.description || null,
      input.sermon_date || null,
      input.published ? 1 : 0,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}

export async function updateSermon(db: D1Database, id: number, input: SermonInput, email: string): Promise<void> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title, id);
  await db
    .prepare(
      `UPDATE sermons SET title=?, slug=?, speaker=?, series=?, scripture_ref=?, video_url=?, video_provider=?,
        description=?, sermon_date=?, published=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.title,
      slug,
      input.speaker || null,
      input.series || null,
      input.scripture_ref || null,
      input.video_url,
      input.video_provider,
      input.description || null,
      input.sermon_date || null,
      input.published ? 1 : 0,
      email,
      id,
    )
    .run();
}

export async function setSermonPublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db
    .prepare("UPDATE sermons SET published=?, updated_at=datetime('now') WHERE id=?")
    .bind(published ? 1 : 0, id)
    .run();
}

export async function deleteSermon(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM sermons WHERE id = ?').bind(id).run();
}

export async function setSermonImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE sermons SET thumbnail_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
