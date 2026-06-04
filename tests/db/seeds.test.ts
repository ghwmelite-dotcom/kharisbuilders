import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTestDb, type TestDb } from '../helpers/d1';

// Split a .sql file into individual statements (strip line comments first).
// Safe here: none of the seed string literals contain a ';'.
function statements(file: string): string[] {
  return readFileSync(file, 'utf8')
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

describe('hybrid generic seeds', () => {
  let ctx: TestDb;
  beforeAll(async () => {
    ctx = await createTestDb(); // applies migrations/*.sql
    for (const f of ['db/seed.sql', 'db/seed_funds.sql', 'db/seed_lists.sql', 'db/seed_sermons_events.sql']) {
      for (const stmt of statements(f)) await ctx.db.prepare(stmt).run();
    }
  });
  afterAll(async () => {
    await ctx.dispose();
  });
  const count = async (t: string) =>
    (await ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>())!.n;

  it('seeds structural rows (funds, ministries, home_cards)', async () => {
    expect(await count('funds')).toBe(4);
    expect(await count('ministries')).toBe(4);
    expect(await count('home_cards')).toBe(3);
  });
  it('leaves people/story/sermons/events empty', async () => {
    expect(await count('leaders')).toBe(0);
    expect(await count('journey')).toBe(0);
    expect(await count('sermons')).toBe(0);
    expect(await count('events')).toBe(0);
  });
  it('seeds no default_theme setting', async () => {
    const row = await ctx.db.prepare("SELECT value FROM site_settings WHERE key='default_theme'").first();
    expect(row).toBeNull();
  });
});
