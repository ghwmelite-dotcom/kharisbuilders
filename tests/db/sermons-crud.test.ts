import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createSermon, updateSermon, deleteSermon, setSermonPublished, getSermonById } from '../../src/lib/db/sermons';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

const base = {
  title: 'Faith',
  slug: '',
  speaker: 'P',
  series: '',
  scripture_ref: '',
  video_url: 'https://youtu.be/abc',
  video_provider: 'youtube' as const,
  description: '',
  sermon_date: '2024-01-01',
  published: true,
};

describe('sermon mutations', () => {
  it('creates with a generated unique slug and records updated_by', async () => {
    const id1 = await createSermon(ctx.db, base, 'admin@x');
    const id2 = await createSermon(ctx.db, base, 'admin@x'); // same title -> slug collision
    const a = await getSermonById(ctx.db, id1);
    const b = await getSermonById(ctx.db, id2);
    expect(a?.slug).toBe('faith');
    expect(b?.slug).toBe('faith-2');
    expect(a?.updated_by).toBe('admin@x');
  });

  it('updates fields', async () => {
    const id = await createSermon(ctx.db, { ...base, title: 'Hope' }, 'a@x');
    await updateSermon(ctx.db, id, { ...base, title: 'Hope Renewed', slug: 'hope' }, 'b@x');
    const s = await getSermonById(ctx.db, id);
    expect(s?.title).toBe('Hope Renewed');
    expect(s?.updated_by).toBe('b@x');
  });

  it('toggles published and deletes', async () => {
    const id = await createSermon(ctx.db, { ...base, title: 'Temp' }, 'a@x');
    await setSermonPublished(ctx.db, id, false);
    expect((await getSermonById(ctx.db, id))?.published).toBe(0);
    await deleteSermon(ctx.db, id);
    expect(await getSermonById(ctx.db, id)).toBeNull();
  });
});
