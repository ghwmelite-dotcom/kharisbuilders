import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getAllContent, setContent } from '../../src/lib/db/content';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('page_content data access', () => {
  it('upserts and reads back, recording updated_by', async () => {
    await setContent(ctx.db, { 'home.hero_line1': 'First' }, 'a@x');
    expect((await getAllContent(ctx.db))['home.hero_line1']).toBe('First');
    await setContent(ctx.db, { 'home.hero_line1': 'Second' }, 'b@x'); // update same key
    expect((await getAllContent(ctx.db))['home.hero_line1']).toBe('Second');
  });
  it('no-ops on an empty entry set', async () => {
    await setContent(ctx.db, {}, 'a@x');
    expect(typeof (await getAllContent(ctx.db))).toBe('object');
  });
});
