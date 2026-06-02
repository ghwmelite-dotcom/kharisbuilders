import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createVisitor } from '../../src/lib/db/visitors';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('createVisitor', () => {
  it('inserts a visitor and returns the new id', async () => {
    const id = await createVisitor(ctx.db, {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '',
      visiting_service: 'Sunday 09:00 AM',
    });
    expect(id).toBeGreaterThan(0);
    const row = await ctx.db
      .prepare('SELECT name, email, visiting_service, source, status FROM visitors WHERE id = ?')
      .bind(id)
      .first();
    expect(row).toMatchObject({
      name: 'Jane Doe',
      email: 'jane@example.com',
      visiting_service: 'Sunday 09:00 AM',
      source: 'visit_form',
      status: 'new',
    });
  });
});
