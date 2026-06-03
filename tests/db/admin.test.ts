import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getCounts, listAllSermons, listAllEvents } from '../../src/lib/db/admin';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, published) VALUES ('Pub', 'pub', 'u', 1)"),
    ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, published) VALUES ('Draft', 'draft', 'u', 0)"),
    ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Up', 'up', '2999-01-01 10:00:00', 1)"),
    ctx.db.prepare("INSERT INTO visitors (name, email) VALUES ('V', 'v@x.org')"),
  ]);
});
afterAll(async () => {
  await ctx.dispose();
});

describe('admin reads', () => {
  it('counts include unpublished rows', async () => {
    const c = await getCounts(ctx.db);
    expect(c.sermons).toBe(2);
    expect(c.events).toBe(1);
    expect(c.visitors).toBe(1);
  });

  it('listAllSermons returns published AND unpublished, newest first', async () => {
    const list = await listAllSermons(ctx.db);
    expect(list.length).toBe(2);
    expect(list.map((s) => s.slug).sort()).toEqual(['draft', 'pub']);
  });

  it('listAllEvents returns events regardless of date', async () => {
    expect((await listAllEvents(ctx.db)).length).toBe(1);
  });
});
