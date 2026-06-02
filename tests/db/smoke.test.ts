import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('D1 test harness', () => {
  it('provides a working in-memory D1 binding', async () => {
    const row = await ctx.db.prepare('SELECT 1 as ok').first<{ ok: number }>();
    expect(row?.ok).toBe(1);
  });
});
