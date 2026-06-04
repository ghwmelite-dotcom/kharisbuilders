export async function getAllContent(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM page_content').all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const row of results) map[row.key] = row.value;
  return map;
}

export async function setContent(db: D1Database, entries: Record<string, string>, email: string): Promise<void> {
  const stmts = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        "INSERT INTO page_content (key, value, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now'), updated_by=excluded.updated_by",
      )
      .bind(key, value, email),
  );
  if (stmts.length) await db.batch(stmts);
}
