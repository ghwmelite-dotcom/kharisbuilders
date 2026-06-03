import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createRegistration, countRegistrations } from '../../src/lib/db/registrations';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db
    .prepare(
      "INSERT INTO events (id, title, slug, start_at, published, registration_enabled) VALUES (1, 'Gala', 'gala', '2999-01-01 10:00:00', 1, 1)",
    )
    .run();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('registrations data access', () => {
  it('creates a registration and counts guests + registrations', async () => {
    const id = await createRegistration(ctx.db, {
      event_id: 1,
      name: 'Ada',
      email: 'ada@x.org',
      phone: '',
      guests: 2,
    });
    expect(id).toBeGreaterThan(0);
    expect(await countRegistrations(ctx.db, 1)).toBe(3); // 1 registrant + 2 guests
  });
});
