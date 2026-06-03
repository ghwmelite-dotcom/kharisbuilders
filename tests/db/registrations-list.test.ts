import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { listRegistrationsForEvent } from '../../src/lib/db/registrations';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db
    .prepare("INSERT INTO events (id, title, slug, start_at, published) VALUES (1, 'E', 'e', '2999-01-01 10:00:00', 1)")
    .run();
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO event_registrations (event_id, name, email, guests) VALUES (1, 'Ada', 'ada@x', 1)"),
    ctx.db.prepare("INSERT INTO event_registrations (event_id, name, email, guests) VALUES (1, 'Bob', 'bob@x', 0)"),
    ctx.db.prepare("INSERT INTO event_registrations (event_id, name, email, guests) VALUES (2, 'Other', 'o@x', 0)"),
  ]);
});
afterAll(async () => {
  await ctx.dispose();
});

describe('listRegistrationsForEvent', () => {
  it('returns only the event’s registrations', async () => {
    const rows = await listRegistrationsForEvent(ctx.db, 1);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.name).sort()).toEqual(['Ada', 'Bob']);
  });
});
