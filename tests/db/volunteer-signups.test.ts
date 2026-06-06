import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createVolunteerSignup,
  listVolunteerSignups,
  setVolunteerSignupStatus,
  deleteVolunteerSignup,
} from '../../src/lib/db/volunteer-signups';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createVolunteerSignup(ctx.db, { role_id: 5, role_name: 'Sunday Greeter', name: 'Ada', email: 'a@x.com', phone: '0800', message: 'Keen' });
  await createVolunteerSignup(ctx.db, { role_id: 6, role_name: 'Parking', name: 'Ben', email: 'b@x.com', phone: '', message: '' });
});
afterAll(async () => {
  await ctx.dispose();
});

describe('volunteer-signups', () => {
  it('stores role_name snapshot + phone, newest first', async () => {
    const rows = await listVolunteerSignups(ctx.db);
    expect(rows.map((x) => x.name)).toEqual(['Ben', 'Ada']);
    expect(rows[1].role_name).toBe('Sunday Greeter');
    expect(rows[1].phone).toBe('0800');
    expect(rows[1].status).toBe('new');
  });
  it('status + delete', async () => {
    await setVolunteerSignupStatus(ctx.db, 1, 'done');
    expect((await listVolunteerSignups(ctx.db)).find((x) => x.id === 1)?.status).toBe('done');
    await deleteVolunteerSignup(ctx.db, 2);
    expect((await listVolunteerSignups(ctx.db)).some((x) => x.id === 2)).toBe(false);
  });
});
