import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { listUpcomingEvents, getEventBySlug } from '../../src/lib/db/events';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('events data access', () => {
  it('lists only published, upcoming events soonest-first', async () => {
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Past', 'past', '2000-01-01 10:00:00', 1)"),
      ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Soon', 'soon', '2999-01-01 10:00:00', 1)"),
      ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Later', 'later', '2999-06-01 10:00:00', 1)"),
      ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Draft', 'draft', '2999-02-01 10:00:00', 0)"),
    ]);
    const list = await listUpcomingEvents(ctx.db);
    expect(list.map((e) => e.slug)).toEqual(['soon', 'later']);
  });

  it('fetches a published event by slug, null for missing/unpublished', async () => {
    expect((await getEventBySlug(ctx.db, 'soon'))?.title).toBe('Soon');
    expect(await getEventBySlug(ctx.db, 'draft')).toBeNull();
  });
});
