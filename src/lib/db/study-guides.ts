export interface CachedGuide {
  content_hash: string;
  guide_json: string;
}

export async function getCachedGuide(db: D1Database, sermonId: number): Promise<CachedGuide | null> {
  const row = await db
    .prepare('SELECT content_hash, guide_json FROM sermon_study_guides WHERE sermon_id = ?')
    .bind(sermonId)
    .first<CachedGuide>();
  return row ?? null;
}

export async function upsertGuide(db: D1Database, sermonId: number, hash: string, json: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sermon_study_guides (sermon_id, content_hash, guide_json, generated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(sermon_id) DO UPDATE SET content_hash=excluded.content_hash, guide_json=excluded.guide_json, generated_at=datetime('now')`,
    )
    .bind(sermonId, hash, json)
    .run();
}

export async function deleteGuide(db: D1Database, sermonId: number): Promise<void> {
  await db.prepare('DELETE FROM sermon_study_guides WHERE sermon_id = ?').bind(sermonId).run();
}
