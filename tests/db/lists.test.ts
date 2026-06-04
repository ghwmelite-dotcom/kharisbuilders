import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  listLeaders,
  createLeader,
  updateLeader,
  getLeaderById,
  deleteLeader,
  setLeaderImage,
} from '../../src/lib/db/leaders';
import { listJourney, createJourney, getJourneyById } from '../../src/lib/db/journey';
import { listHomeCards, createHomeCard, getHomeCardById } from '../../src/lib/db/homeCards';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('editable lists data access', () => {
  it('leaders: create/list ordered/update/setImage/delete', async () => {
    const b = await createLeader(ctx.db, { name: 'B', role: 'r', sort_order: 2 }, 'a@x');
    const a = await createLeader(ctx.db, { name: 'A', role: 'r', sort_order: 1 }, 'a@x');
    expect((await listLeaders(ctx.db)).map((l) => l.id)).toEqual([a, b]); // sort_order asc
    await updateLeader(ctx.db, a, { name: 'A2', role: 'r2', sort_order: 1 }, 'b@x');
    expect((await getLeaderById(ctx.db, a))?.name).toBe('A2');
    await setLeaderImage(ctx.db, a, 'leaders/x.jpg');
    expect((await getLeaderById(ctx.db, a))?.image_key).toBe('leaders/x.jpg');
    await deleteLeader(ctx.db, b);
    expect(await getLeaderById(ctx.db, b)).toBeNull();
  });
  it('journey: create + list + get', async () => {
    const id = await createJourney(ctx.db, { year: '2030', title: 'Future', body: 'x', sort_order: 1 }, 'a@x');
    expect((await getJourneyById(ctx.db, id))?.year).toBe('2030');
    expect((await listJourney(ctx.db)).some((j) => j.id === id)).toBe(true);
  });
  it('home_cards: create + list + get', async () => {
    const id = await createHomeCard(ctx.db, { eyebrow: 'E', title: 'T', description: 'd', href: '/x', sort_order: 1 }, 'a@x');
    expect((await getHomeCardById(ctx.db, id))?.href).toBe('/x');
    expect((await listHomeCards(ctx.db)).some((h) => h.id === id)).toBe(true);
  });
});
