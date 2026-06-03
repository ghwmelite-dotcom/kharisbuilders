import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { listPublishedSermons, getSermonBySlug } from '../../src/lib/db/sermons';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('sermons data access', () => {
  it('lists only published sermons, newest first', async () => {
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, sermon_date, published) VALUES ('Old', 'old', 'u', '2024-01-01', 1)"),
      ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, sermon_date, published) VALUES ('New', 'new', 'u', '2024-06-01', 1)"),
      ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, sermon_date, published) VALUES ('Draft', 'draft', 'u', '2024-07-01', 0)"),
    ]);
    const list = await listPublishedSermons(ctx.db);
    expect(list.map((s) => s.slug)).toEqual(['new', 'old']);
  });

  it('fetches a published sermon by slug, and null for missing/unpublished', async () => {
    expect((await getSermonBySlug(ctx.db, 'new'))?.title).toBe('New');
    expect(await getSermonBySlug(ctx.db, 'draft')).toBeNull();
    expect(await getSermonBySlug(ctx.db, 'missing')).toBeNull();
  });
});
