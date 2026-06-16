import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createPost,
  updatePost,
  getPostBySlug,
  getPostById,
  listPublishedPosts,
  listPublishedPostsByCategory,
  listCategories,
  setPostPublished,
  deletePost,
} from '../../src/lib/db/blog';
import { getCounts, listAllPosts as adminListAllPosts } from '../../src/lib/db/admin';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('blog data layer', () => {
  it('creates a post, deriving excerpt + read-time, and reads it back', async () => {
    const id = await createPost(
      ctx.db,
      { title: 'Grace Abounds', body: 'one two three four five', category: 'Teaching', tags: 'grace, faith', published: true, published_at: '2026-06-01' },
      'admin@x.org',
    );
    const post = await getPostById(ctx.db, id);
    expect(post).not.toBeNull();
    expect(post!.slug).toBe('grace-abounds');
    expect(post!.read_minutes).toBe(1);
    expect(post!.excerpt).toBe('one two three four five');
    expect(post!.published).toBe(1);
  });

  it('keeps a manual excerpt when provided', async () => {
    const id = await createPost(
      ctx.db,
      { title: 'Manual Excerpt', body: 'a long body here', excerpt: 'Hand-written summary.', published: true },
      'admin@x.org',
    );
    const post = await getPostById(ctx.db, id);
    expect(post!.excerpt).toBe('Hand-written summary.');
  });

  it('suffixes duplicate slugs', async () => {
    const id = await createPost(ctx.db, { title: 'Grace Abounds', body: 'x', published: true }, 'a@x.org');
    const post = await getPostById(ctx.db, id);
    expect(post!.slug).toBe('grace-abounds-2');
  });

  it('lists only published posts, newest first', async () => {
    await createPost(ctx.db, { title: 'Draft One', body: 'x', published: false }, 'a@x.org');
    await createPost(ctx.db, { title: 'Older Post', body: 'x', published: true, published_at: '2020-01-01' }, 'a@x.org');
    await createPost(ctx.db, { title: 'Newer Post', body: 'x', published: true, published_at: '2030-01-01' }, 'a@x.org');
    const published = await listPublishedPosts(ctx.db);
    // drafts excluded
    expect(published.every((p) => p.slug !== 'draft-one')).toBe(true);
    // deterministic ordering: the explicitly-newer post sorts before the explicitly-older one
    const newerIdx = published.findIndex((p) => p.slug === 'newer-post');
    const olderIdx = published.findIndex((p) => p.slug === 'older-post');
    expect(newerIdx).toBeGreaterThanOrEqual(0);
    expect(olderIdx).toBeGreaterThan(newerIdx);
  });

  it('filters by category and lists distinct categories', async () => {
    const teaching = await listPublishedPostsByCategory(ctx.db, 'Teaching');
    expect(teaching.length).toBeGreaterThanOrEqual(1);
    expect(teaching.every((p) => p.category === 'Teaching')).toBe(true);
    expect(await listCategories(ctx.db)).toContain('Teaching');
  });

  it('getPostBySlug only returns published posts', async () => {
    expect(await getPostBySlug(ctx.db, 'draft-one')).toBeNull();
    expect((await getPostBySlug(ctx.db, 'grace-abounds'))?.title).toBe('Grace Abounds');
  });

  it('updates, toggles publish, and deletes', async () => {
    const id = await createPost(ctx.db, { title: 'Temp', body: 'x', published: true }, 'a@x.org');
    await updatePost(ctx.db, id, { title: 'Temp Renamed', body: 'x y z', published: true }, 'b@x.org');
    expect((await getPostById(ctx.db, id))!.title).toBe('Temp Renamed');
    await setPostPublished(ctx.db, id, false);
    expect((await getPostById(ctx.db, id))!.published).toBe(0);
    await deletePost(ctx.db, id);
    expect(await getPostById(ctx.db, id)).toBeNull();
  });
});

describe('blog admin reads', () => {
  it('getCounts includes blog (published + drafts)', async () => {
    const c = await getCounts(ctx.db);
    expect(typeof c.blog).toBe('number');
    expect(c.blog).toBeGreaterThanOrEqual(1);
  });
  it('listAllPosts returns drafts + published, newest first', async () => {
    const rows = await adminListAllPosts(ctx.db);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty('published');
  });
});
