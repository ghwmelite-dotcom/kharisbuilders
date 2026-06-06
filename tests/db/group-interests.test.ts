import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createGroupInterest,
  listGroupInterests,
  setGroupInterestStatus,
  deleteGroupInterest,
} from '../../src/lib/db/group-interests';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createGroupInterest(ctx.db, { group_id: 5, group_name: 'Tuesday Group', name: 'Ada', email: 'a@x.com', message: 'Keen' });
  await createGroupInterest(ctx.db, { group_id: 6, group_name: 'Mens', name: 'Ben', email: 'b@x.com', message: '' });
});
afterAll(async () => {
  await ctx.dispose();
});

describe('group-interests', () => {
  it('stores the group_name snapshot, newest first', async () => {
    const rows = await listGroupInterests(ctx.db);
    expect(rows.map((r) => r.name)).toEqual(['Ben', 'Ada']);
    expect(rows[1].group_name).toBe('Tuesday Group');
    expect(rows[1].status).toBe('new');
  });
  it('status + delete', async () => {
    await setGroupInterestStatus(ctx.db, 1, 'done');
    expect((await listGroupInterests(ctx.db)).find((r) => r.id === 1)?.status).toBe('done');
    await deleteGroupInterest(ctx.db, 2);
    expect((await listGroupInterests(ctx.db)).some((r) => r.id === 2)).toBe(false);
  });
});
