import { describe, it, expect } from 'vitest';
import type { Sermon } from '../../src/lib/db/sermons';
import { selectContexts } from '../../src/lib/ai/ask';

function mkSermon(over: Partial<Sermon>): Sermon {
  return {
    id: 1,
    title: 'Faith',
    slug: 'faith',
    speaker: 'Pastor A',
    series: null,
    scripture_ref: 'Hebrews 11',
    video_url: '',
    video_provider: 'youtube',
    thumbnail_key: null,
    description: 'A sermon about faith.',
    transcript: 'Faith is being sure of what we hope for.',
    sermon_date: '2026-01-01',
    ...over,
  } as Sermon;
}

describe('selectContexts', () => {
  it('numbers contexts 1..n and caps to maxSermons', () => {
    const sermons = [1, 2, 3, 4, 5].map((id) => mkSermon({ id, slug: `s${id}`, title: `S${id}` }));
    const ctx = selectContexts(sermons, { maxSermons: 3 });
    expect(ctx.length).toBe(3);
    expect(ctx.map((c) => c.n)).toEqual([1, 2, 3]);
    expect(ctx[0].slug).toBe('s1');
    expect(ctx[0].title).toBe('S1');
  });
  it('truncates each sermon text to perSermonChars', () => {
    const long = 'x'.repeat(5000);
    const ctx = selectContexts([mkSermon({ transcript: long })], { perSermonChars: 100 });
    expect(ctx[0].text.length).toBeLessThanOrEqual(100);
  });
  it('carries speaker and scripture for citations', () => {
    const ctx = selectContexts([mkSermon({ speaker: 'Pastor B', scripture_ref: 'John 3' })]);
    expect(ctx[0].speaker).toBe('Pastor B');
    expect(ctx[0].scripture_ref).toBe('John 3');
  });
});
