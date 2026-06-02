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
