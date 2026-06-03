import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createSermon, getSermonById, setSermonImage } from '../../src/lib/db/sermons';
import { createEvent, getEventById, setEventImage } from '../../src/lib/db/events';
import { createMinistry, getMinistryById, setMinistryImage } from '../../src/lib/db/ministries';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('setImage helpers', () => {
  it('sets sermon thumbnail_key', async () => {
    const id = await createSermon(
      ctx.db,
      {
        title: 'S',
        slug: '',
        speaker: '',
        series: '',
        scripture_ref: '',
        video_url: 'https://youtu.be/x',
        video_provider: 'youtube',
        description: '',
        sermon_date: '',
        published: true,
      },
      'a@x',
    );
    await setSermonImage(ctx.db, id, 'sermons/k.jpg');
    expect((await getSermonById(ctx.db, id))?.thumbnail_key).toBe('sermons/k.jpg');
  });

  it('sets event + ministry image_key', async () => {
    const eid = await createEvent(
      ctx.db,
      {
        title: 'E',
        slug: '',
        category: '',
        description: '',
        start_at: '2999-01-01 10:00:00',
        end_at: '',
        location: '',
        registration_enabled: false,
        capacity: undefined,
        published: true,
      },
      'a@x',
    );
    await setEventImage(ctx.db, eid, 'events/e.jpg');
    expect((await getEventById(ctx.db, eid))?.image_key).toBe('events/e.jpg');

    const mid = await createMinistry(
      ctx.db,
      { name: 'M', slug: '', description: 'd', leader: '', meeting_time: '', sort_order: 0, published: true },
      'a@x',
    );
    await setMinistryImage(ctx.db, mid, 'ministries/m.jpg');
    expect((await getMinistryById(ctx.db, mid))?.image_key).toBe('ministries/m.jpg');
  });
});
