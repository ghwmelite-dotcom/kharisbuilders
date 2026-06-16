import type { BlogPostInput } from './schemas';
import { slugify, uniqueSlug } from '../slug';
import { deriveExcerpt, readMinutes } from '../blog/markdown';

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  author: string | null;
  category: string | null;
  tags: string | null;
  excerpt: string | null;
  body: string;
  cover_key: string | null;
  read_minutes: number | null;
  published_at: string | null;
  created_at: string;
}

export interface BlogPostFull extends BlogPost {
  published: number;
  updated_by: string | null;
}

const COLS =
  'id, title, slug, author, category, tags, excerpt, body, cover_key, read_minutes, published_at, created_at';

export async function listPublishedPosts(db: D1Database, limit = 50): Promise<BlogPost[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM blog_posts WHERE published = 1
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ?`,
    )
    .bind(limit)
    .all<BlogPost>();
  return results;
}

export async function listPublishedPostsByCategory(db: D1Database, category: string, limit = 50): Promise<BlogPost[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM blog_posts WHERE published = 1 AND category = ?
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ?`,
    )
    .bind(category, limit)
    .all<BlogPost>();
  return results;
}

export async function listCategories(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT category FROM blog_posts WHERE published = 1 AND category IS NOT NULL AND category <> '' ORDER BY category`,
    )
    .all<{ category: string }>();
  return results.map((r) => r.category);
}

export async function getPostBySlug(db: D1Database, slug: string): Promise<BlogPost | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM blog_posts WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<BlogPost>();
  return row ?? null;
}

export async function getPostById(db: D1Database, id: number): Promise<BlogPostFull | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM blog_posts WHERE id = ?`)
    .bind(id)
    .first<BlogPostFull>();
  return row ?? null;
}

async function resolveSlug(db: D1Database, desired: string, title: string, excludeId?: number): Promise<string> {
  const base = slugify(desired || title);
  const exists = async (s: string) => {
    const row = await db.prepare('SELECT id FROM blog_posts WHERE slug = ?').bind(s).first<{ id: number }>();
    return row != null && row.id !== excludeId;
  };
  return uniqueSlug(exists, base);
}

export async function createPost(db: D1Database, input: BlogPostInput, email: string): Promise<number> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title);
  const excerpt = (input.excerpt && input.excerpt.trim()) || deriveExcerpt(input.body);
  const r = await db
    .prepare(
      `INSERT INTO blog_posts (title, slug, author, category, tags, excerpt, body, read_minutes, published, published_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.title,
      slug,
      input.author || null,
      input.category || null,
      input.tags || null,
      excerpt,
      input.body,
      readMinutes(input.body),
      input.published ? 1 : 0,
      input.published_at || null,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}

export async function updatePost(db: D1Database, id: number, input: BlogPostInput, email: string): Promise<void> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title, id);
  const excerpt = (input.excerpt && input.excerpt.trim()) || deriveExcerpt(input.body);
  await db
    .prepare(
      `UPDATE blog_posts SET title=?, slug=?, author=?, category=?, tags=?, excerpt=?, body=?, read_minutes=?,
        published=?, published_at=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.title,
      slug,
      input.author || null,
      input.category || null,
      input.tags || null,
      excerpt,
      input.body,
      readMinutes(input.body),
      input.published ? 1 : 0,
      input.published_at || null,
      email,
      id,
    )
    .run();
}

export async function setPostPublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db
    .prepare("UPDATE blog_posts SET published=?, updated_at=datetime('now') WHERE id=?")
    .bind(published ? 1 : 0, id)
    .run();
}

export async function setPostCover(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE blog_posts SET cover_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
}
