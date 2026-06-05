import { describe, it, expect } from 'vitest';
import type { Sermon } from '../../src/lib/db/sermons';
import { selectContexts, buildAskMessages, FALLBACK_ANSWER } from '../../src/lib/ai/ask';

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

describe('buildAskMessages', () => {
  const contexts = selectContexts([
    mkSermon({ id: 1, slug: 'a', title: 'Anxiety', speaker: 'Pastor A', scripture_ref: 'Phil 4' }),
  ]);
  const msgs = buildAskMessages('How do I deal with worry?', contexts);

  it('has a system message that constrains answers to the excerpts', () => {
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toMatch(/only/i);
    expect(msgs[0].content).toMatch(/excerpt|sermon/i);
  });
  it('puts the question and a numbered block in the user message', () => {
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toContain('How do I deal with worry?');
    expect(msgs[1].content).toContain('[1]');
    expect(msgs[1].content).toContain('Anxiety');
  });
});

describe('FALLBACK_ANSWER', () => {
  it('is a non-empty, non-doctrinal deflection', () => {
    expect(typeof FALLBACK_ANSWER).toBe('string');
    expect(FALLBACK_ANSWER.length).toBeGreaterThan(20);
  });
});
