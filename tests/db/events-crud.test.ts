import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createEvent, updateEvent, deleteEvent, setEventPublished, getEventById } from '../../src/lib/db/events';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

const base = {
  title: 'Gala',
  slug: '',
  category: 'Community',
  description: '',
  start_at: '2999-01-01 10:00:00',
  end_at: '',
  location: 'Hall',
  registration_enabled: true,
  capacity: 50,
  published: true,
};

describe('event mutations', () => {
  it('creates with a unique slug, records updated_by, keeps capacity', async () => {
    const id1 = await createEvent(ctx.db, base, 'admin@x');
    const id2 = await createEvent(ctx.db, base, 'admin@x');
    const a = await getEventById(ctx.db, id1);
    const b = await getEventById(ctx.db, id2);
    expect(a?.slug).toBe('gala');
    expect(b?.slug).toBe('gala-2');
    expect(a?.capacity).toBe(50);
    expect(a?.updated_by).toBe('admin@x');
  });

  it('allows unlimited capacity (undefined -> NULL)', async () => {
    const id = await createEvent(ctx.db, { ...base, title: 'Free', capacity: undefined }, 'a@x');
    expect((await getEventById(ctx.db, id))?.capacity).toBeNull();
  });

  it('updates, toggles published, deletes', async () => {
    const id = await createEvent(ctx.db, { ...base, title: 'Temp' }, 'a@x');
    await updateEvent(ctx.db, id, { ...base, title: 'Temp 2', slug: 'temp' }, 'b@x');
    expect((await getEventById(ctx.db, id))?.title).toBe('Temp 2');
    await setEventPublished(ctx.db, id, false);
    expect((await getEventById(ctx.db, id))?.published).toBe(0);
    await deleteEvent(ctx.db, id);
    expect(await getEventById(ctx.db, id)).toBeNull();
  });
});
