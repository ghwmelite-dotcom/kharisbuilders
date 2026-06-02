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

export async function listPublishedMinistries(db: D1Database): Promise<Ministry[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, slug, description, image_key, leader, meeting_time, sort_order
       FROM ministries WHERE published = 1 ORDER BY sort_order ASC, name ASC`,
    )
    .all<Ministry>();
  return results;
}
