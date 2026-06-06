import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createRole,
  listPublishedRoles,
  listAllRoles,
  getRoleById,
  setRolePublished,
  deleteRole,
} from '../../src/lib/db/volunteer-roles';

const r = (over: Record<string, unknown> = {}) => ({
  name: 'Sunday Greeter',
  description: 'Welcome people at the door.',
  area: 'hospitality',
  commitment: 'weekly',
  schedule: 'Sundays, 8-10am',
  requirements: '',
  leader: 'Ada',
  sort_order: 0,
  published: false,
  ...over,
});

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createRole(ctx.db, r({ name: 'A', sort_order: 2, published: true }), 'admin@x');
  await createRole(ctx.db, r({ name: 'B', sort_order: 1, published: true }), 'admin@x');
  await createRole(ctx.db, r({ name: 'Draft', published: false }), 'admin@x');
});
afterAll(async () => {
  await ctx.dispose();
});

describe('volunteer-roles', () => {
  it('listPublishedRoles returns only published, ordered by sort_order', async () => {
    const rows = await listPublishedRoles(ctx.db);
    expect(rows.map((x) => x.name)).toEqual(['B', 'A']);
  });
  it('listAllRoles includes drafts; getRoleById works', async () => {
    expect((await listAllRoles(ctx.db)).length).toBe(3);
    expect((await getRoleById(ctx.db, 1))?.name).toBe('A');
  });
  it('publish toggle + delete', async () => {
    await setRolePublished(ctx.db, 3, true);
    expect((await listPublishedRoles(ctx.db)).length).toBe(3);
    await deleteRole(ctx.db, 3);
    expect((await listAllRoles(ctx.db)).some((x) => x.id === 3)).toBe(false);
  });
});
