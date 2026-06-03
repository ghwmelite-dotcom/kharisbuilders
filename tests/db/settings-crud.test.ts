import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { setSettings, getAllSettings, getSetting } from '../../src/lib/db/settings';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('setSettings', () => {
  it('inserts new keys then updates only the given keys', async () => {
    await setSettings(ctx.db, { address: 'A', phone: 'B' });
    let all = await getAllSettings(ctx.db);
    expect(all.address).toBe('A');
    expect(all.phone).toBe('B');

    await setSettings(ctx.db, { address: 'C' });
    all = await getAllSettings(ctx.db);
    expect(all.address).toBe('C');
    expect(all.phone).toBe('B'); // untouched
    expect(await getSetting(ctx.db, 'address')).toBe('C');
  });
});
