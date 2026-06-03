import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createMinistry,
  updateMinistry,
  deleteMinistry,
  setMinistryPublished,
  getMinistryById,
} from '../../src/lib/db/ministries';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

const base = {
  name: 'Worship',
  slug: '',
  description: 'Music',
  leader: 'Grace',
  meeting_time: 'Sundays',
  sort_order: 1,
  published: true,
};

describe('ministry mutations', () => {
  it('creates with a unique slug and records updated_by', async () => {
    const id1 = await createMinistry(ctx.db, base, 'admin@x');
    const id2 = await createMinistry(ctx.db, base, 'admin@x');
    expect((await getMinistryById(ctx.db, id1))?.slug).toBe('worship');
    expect((await getMinistryById(ctx.db, id2))?.slug).toBe('worship-2');
    expect((await getMinistryById(ctx.db, id1))?.updated_by).toBe('admin@x');
  });

  it('updates, toggles published, deletes', async () => {
    const id = await createMinistry(ctx.db, { ...base, name: 'Temp' }, 'a@x');
    await updateMinistry(ctx.db, id, { ...base, name: 'Temp 2', slug: 'temp' }, 'b@x');
    expect((await getMinistryById(ctx.db, id))?.name).toBe('Temp 2');
    await setMinistryPublished(ctx.db, id, false);
    expect((await getMinistryById(ctx.db, id))?.published).toBe(0);
    await deleteMinistry(ctx.db, id);
    expect(await getMinistryById(ctx.db, id)).toBeNull();
  });
});
