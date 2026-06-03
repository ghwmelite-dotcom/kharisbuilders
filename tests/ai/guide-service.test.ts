import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createSermon, getSermonById } from '../../src/lib/db/sermons';
import { getOrGenerateGuide } from '../../src/lib/ai/guide-service';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

const sermon = (over = {}) => ({
  title: 'Faith',
  slug: 'faith',
  speaker: '',
  series: '',
  scripture_ref: 'Heb 11',
  video_url: 'https://youtu.be/x',
  video_provider: 'youtube' as const,
  description: 'On trusting God deeply through every season of life.',
  transcript: '',
  sermon_date: '2024-01-01',
  published: true,
  ...over,
});

describe('getOrGenerateGuide', () => {
  it('generates + caches on miss, then serves cache without calling AI', async () => {
    const id = await createSermon(ctx.db, sermon(), 'a@x');
    const full = await getSermonById(ctx.db, id);
    const ai = {
      embed: vi.fn(),
      generate: vi.fn(
        async () =>
          '{"summary":"Trust God","key_points":["a"],"reflection_questions":["q"],"related_scriptures":["Heb 11"]}',
      ),
    };

    const g1 = await getOrGenerateGuide(ctx.db, ai, full!);
    expect(g1?.summary).toBe('Trust God');
    expect(ai.generate).toHaveBeenCalledTimes(1);

    const g2 = await getOrGenerateGuide(ctx.db, ai, full!);
    expect(g2?.summary).toBe('Trust God');
    expect(ai.generate).toHaveBeenCalledTimes(1); // served from cache
  });

  it('returns null when there is no real content to summarise', async () => {
    const id = await createSermon(ctx.db, sermon({ slug: 'bare', description: '', transcript: '' }), 'a@x');
    const full = await getSermonById(ctx.db, id);
    const ai = { embed: vi.fn(), generate: vi.fn() };
    const g = await getOrGenerateGuide(ctx.db, ai, full!);
    expect(g).toBeNull();
    expect(ai.generate).not.toHaveBeenCalled();
  });
});
