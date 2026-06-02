import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { listPublishedMinistries } from '../../src/lib/db/ministries';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('ministries data access', () => {
  it('returns only published ministries, ordered by sort_order', async () => {
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO ministries (name, slug, description, sort_order, published) VALUES ('Youth', 'youth', 'Teens', 2, 1)"),
      ctx.db.prepare("INSERT INTO ministries (name, slug, description, sort_order, published) VALUES ('Worship', 'worship', 'Music', 1, 1)"),
      ctx.db.prepare("INSERT INTO ministries (name, slug, description, sort_order, published) VALUES ('Hidden', 'hidden', 'Draft', 0, 0)"),
    ]);
    const list = await listPublishedMinistries(ctx.db);
    expect(list.map((m) => m.slug)).toEqual(['worship', 'youth']);
    expect(list.find((m) => m.slug === 'hidden')).toBeUndefined();
  });
});
