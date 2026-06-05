import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createConnection,
  listConnections,
  setConnectionStatus,
  deleteConnection,
} from '../../src/lib/db/connections';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createConnection(ctx.db, { name: 'Ada', email: 'a@x.com', phone: '', steps: ['serve', 'group'], message: '' });
  await createConnection(ctx.db, { name: 'Ben', email: 'b@x.com', phone: '123', steps: [], message: 'Just saying hi' });
});
afterAll(async () => {
  await ctx.dispose();
});

describe('connections', () => {
  it('stores steps as JSON and reads them back as an array, newest first', async () => {
    const rows = await listConnections(ctx.db);
    expect(rows.map((r) => r.name)).toEqual(['Ben', 'Ada']);
    expect(rows[1].steps).toEqual(['serve', 'group']);
    expect(rows[0].steps).toEqual([]);
    expect(rows[0].message).toBe('Just saying hi');
    expect(rows[0].status).toBe('new');
  });
  it('setConnectionStatus + deleteConnection work', async () => {
    await setConnectionStatus(ctx.db, 1, 'done');
    expect((await listConnections(ctx.db)).find((r) => r.id === 1)?.status).toBe('done');
    await deleteConnection(ctx.db, 2);
    expect((await listConnections(ctx.db)).some((r) => r.id === 2)).toBe(false);
  });
});
