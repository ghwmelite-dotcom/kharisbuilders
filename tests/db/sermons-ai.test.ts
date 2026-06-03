import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createSermon, getPublishedSermonsByIds, searchSermonsKeyword } from '../../src/lib/db/sermons';
import { getCachedGuide, upsertGuide, deleteGuide } from '../../src/lib/db/study-guides';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

const s = (over: Record<string, unknown> = {}) => ({
  title: 'Faith',
  slug: '',
  speaker: '',
  series: '',
  scripture_ref: 'Heb 11',
  video_url: 'https://youtu.be/x',
  video_provider: 'youtube' as const,
  description: 'trusting God',
  transcript: '',
  sermon_date: '2024-01-01',
  published: true,
  ...over,
});

describe('sermon AI db helpers', () => {
  it('getPublishedSermonsByIds returns published rows in the given order', async () => {
    const a = await createSermon(ctx.db, s({ title: 'Anxiety', slug: 'anxiety' }), 'a@x');
    const b = await createSermon(ctx.db, s({ title: 'Marriage', slug: 'marriage' }), 'a@x');
    const draft = await createSermon(ctx.db, s({ title: 'Draft', slug: 'draft', published: false }), 'a@x');
    const rows = await getPublishedSermonsByIds(ctx.db, [b, a, draft]);
    expect(rows.map((r) => r.id)).toEqual([b, a]); // draft dropped, order preserved
  });
  it('searchSermonsKeyword matches title/description', async () => {
    const rows = await searchSermonsKeyword(ctx.db, 'Anxiety');
    expect(rows.some((r) => r.title === 'Anxiety')).toBe(true);
  });
  it('study-guide cache upsert/get/delete', async () => {
    const id = await createSermon(ctx.db, s({ title: 'Cache', slug: 'cache' }), 'a@x');
    await upsertGuide(ctx.db, id, 'h1', '{"summary":"x"}');
    expect((await getCachedGuide(ctx.db, id))?.content_hash).toBe('h1');
    await upsertGuide(ctx.db, id, 'h2', '{"summary":"y"}'); // replace
    expect((await getCachedGuide(ctx.db, id))?.content_hash).toBe('h2');
    await deleteGuide(ctx.db, id);
    expect(await getCachedGuide(ctx.db, id)).toBeNull();
  });
});
