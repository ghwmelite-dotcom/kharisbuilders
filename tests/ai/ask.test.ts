import { describe, it, expect, vi } from 'vitest';
import type { Sermon } from '../../src/lib/db/sermons';
import { selectContexts, buildAskMessages, FALLBACK_ANSWER, answerQuestion } from '../../src/lib/ai/ask';
import type { AIClient, VectorStore } from '../../src/lib/ai/clients';

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

function mkDeps(matches: { id: string; score: number }[], sermons: Sermon[], generated = 'Answer [1].') {
  const ai: AIClient = {
    embed: vi.fn(async () => [0.1, 0.2, 0.3]),
    generate: vi.fn(async () => generated),
  };
  const store: VectorStore = {
    query: vi.fn(async () => matches),
    upsert: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  const fetchSermons = vi.fn(async (ids: number[]) => sermons.filter((s) => ids.includes(s.id)));
  return { ai, store, fetchSermons };
}

describe('answerQuestion', () => {
  it('returns the generated answer + citations for retrieved sermons', async () => {
    const sermons = [mkSermon({ id: 1, slug: 'a', title: 'A' }), mkSermon({ id: 2, slug: 'b', title: 'B' })];
    const deps = mkDeps([{ id: '1', score: 0.9 }, { id: '2', score: 0.8 }], sermons, 'Here is the answer [1].');
    const res = await answerQuestion(deps, 'a question');
    expect(res.answer).toBe('Here is the answer [1].');
    expect(res.citations.map((c) => c.slug)).toEqual(['a', 'b']);
    expect(deps.ai.generate).toHaveBeenCalledTimes(1);
  });

  it('returns the fallback WITHOUT calling generate when nothing is retrieved', async () => {
    const deps = mkDeps([], []); // store returns no matches
    const res = await answerQuestion(deps, 'obscure question');
    expect(res.answer).toBe(FALLBACK_ANSWER);
    expect(res.citations).toEqual([]);
    expect(deps.ai.generate).not.toHaveBeenCalled();
  });

  it('returns the fallback (no generate) when ids resolve to no published sermons', async () => {
    const deps = mkDeps([{ id: '9', score: 0.5 }], []); // match id 9, but fetch finds none
    const res = await answerQuestion(deps, 'q');
    expect(res.answer).toBe(FALLBACK_ANSWER);
    expect(deps.ai.generate).not.toHaveBeenCalled();
  });
});
