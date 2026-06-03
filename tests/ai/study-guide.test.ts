import { describe, it, expect } from 'vitest';
import { buildStudyGuideMessages, parseStudyGuide } from '../../src/lib/ai/study-guide';

describe('buildStudyGuideMessages', () => {
  it('includes the sermon text and a JSON instruction', () => {
    const msgs = buildStudyGuideMessages({ title: 'Faith' }, 'On trusting God.');
    expect(msgs[0].role).toBe('system');
    expect(msgs.some((m) => m.content.includes('JSON'))).toBe(true);
    expect(msgs.some((m) => m.content.includes('On trusting God.'))).toBe(true);
  });
});

describe('parseStudyGuide', () => {
  it('parses clean JSON', () => {
    const g = parseStudyGuide('{"summary":"S","key_points":["a","b"],"reflection_questions":["q"],"related_scriptures":["Heb 11"]}');
    expect(g.summary).toBe('S');
    expect(g.keyPoints).toEqual(['a', 'b']);
    expect(g.reflectionQuestions).toEqual(['q']);
    expect(g.relatedScriptures).toEqual(['Heb 11']);
  });
  it('extracts JSON wrapped in prose/fences', () => {
    const g = parseStudyGuide('Here you go:\n```json\n{"summary":"S","key_points":[]}\n```\nHope that helps');
    expect(g.summary).toBe('S');
    expect(g.keyPoints).toEqual([]);
  });
  it('falls back to summary-only on unparseable output', () => {
    const g = parseStudyGuide('I could not format this.');
    expect(g.summary).toBe('I could not format this.');
    expect(g.keyPoints).toEqual([]);
    expect(g.reflectionQuestions).toEqual([]);
  });
});
