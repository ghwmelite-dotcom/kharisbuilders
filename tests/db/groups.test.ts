import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createGroup,
  listPublishedGroups,
  listAllGroups,
  getGroupById,
  setGroupPublished,
  deleteGroup,
} from '../../src/lib/db/groups';

const g = (over: Record<string, unknown> = {}) => ({
  name: 'Tuesday Group',
  description: 'A warm group.',
  day: 'Tuesday',
  time: '7:00 PM',
  location: 'Eastside',
  format: 'in_person',
  audience: 'everyone',
  leader: 'Ada',
  sort_order: 0,
  published: false,
  ...over,
});

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createGroup(ctx.db, g({ name: 'A', sort_order: 2, published: true }), 'admin@x');
  await createGroup(ctx.db, g({ name: 'B', sort_order: 1, published: true }), 'admin@x');
  await createGroup(ctx.db, g({ name: 'Draft', published: false }), 'admin@x');
});
afterAll(async () => {
  await ctx.dispose();
});

describe('groups', () => {
  it('listPublishedGroups returns only published, ordered by sort_order', async () => {
    const rows = await listPublishedGroups(ctx.db);
    expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
  });
  it('listAllGroups includes drafts; getGroupById works', async () => {
    expect((await listAllGroups(ctx.db)).length).toBe(3);
    expect((await getGroupById(ctx.db, 1))?.name).toBe('A');
  });
  it('publish toggle + delete', async () => {
    await setGroupPublished(ctx.db, 3, true);
    expect((await listPublishedGroups(ctx.db)).length).toBe(3);
    await deleteGroup(ctx.db, 3);
    expect((await listAllGroups(ctx.db)).some((r) => r.id === 3)).toBe(false);
  });
});
