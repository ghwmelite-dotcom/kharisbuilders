import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getAllSettings, getSetting } from '../../src/lib/db/settings';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('settings data access', () => {
  it('returns a value for a known key after seeding', async () => {
    await ctx.db
      .prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('contact_email', 'hello@example.com')")
      .run();
    expect(await getSetting(ctx.db, 'contact_email')).toBe('hello@example.com');
  });

  it('returns null for a missing key', async () => {
    expect(await getSetting(ctx.db, 'does_not_exist')).toBeNull();
  });

  it('returns all settings as a key->value map', async () => {
    await ctx.db
      .prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('phone', '+44 20 7946 0000')")
      .run();
    const all = await getAllSettings(ctx.db);
    expect(all.phone).toBe('+44 20 7946 0000');
    expect(all.contact_email).toBe('hello@example.com');
  });
});
