import type { VideoProvider } from '../video';

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
