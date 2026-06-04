import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createOnlineAttendance, listOnlineAttendances } from '../../src/lib/db/online-attendances';
import { createPrayerRequest, listPrayerRequests } from '../../src/lib/db/prayer-requests';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('live tables', () => {
  it('online attendance create + list', async () => {
    await createOnlineAttendance(ctx.db, { name: 'A', email: 'a@x.com', location: 'Accra' });
    const rows = await listOnlineAttendances(ctx.db);
    expect(rows[0].name).toBe('A');
    expect(rows[0].location).toBe('Accra');
  });
  it('prayer request create + list (private default)', async () => {
    await createPrayerRequest(ctx.db, { name: '', email: '', request: 'Please pray', is_private: true });
    const rows = await listPrayerRequests(ctx.db);
    expect(rows[0].request).toBe('Please pray');
    expect(rows[0].is_private).toBe(1);
  });
});
