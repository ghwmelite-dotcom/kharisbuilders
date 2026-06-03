export type SettingsMap = Record<string, string>;

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM site_settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function getAllSettings(db: D1Database): Promise<SettingsMap> {
  const { results } = await db
    .prepare('SELECT key, value FROM site_settings')
    .all<{ key: string; value: string }>();
  const map: SettingsMap = {};
  for (const row of results) map[row.key] = row.value;
  return map;
}

/** Upsert the given key/value settings (leaves other keys untouched). */
export async function setSettings(db: D1Database, entries: Record<string, string>): Promise<void> {
  const stmts = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')",
      )
      .bind(key, value),
  );
  if (stmts.length) await db.batch(stmts);
}
