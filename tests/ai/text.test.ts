import { describe, it, expect } from 'vitest';
import { composeSermonText, truncate } from '../../src/lib/ai/text';

const base = {
  title: 'Faith That Builds',
  speaker: 'Pastor A',
  series: 'Foundations',
  scripture_ref: 'Heb 11',
  description: 'On trusting God.',
  transcript: null as string | null,
};

describe('composeSermonText', () => {
  it('joins the metadata fields', () => {
    const t = composeSermonText(base);
    expect(t).toContain('Faith That Builds');
    expect(t).toContain('Heb 11');
    expect(t).toContain('On trusting God.');
  });
  it('includes the transcript when present', () => {
    expect(composeSermonText({ ...base, transcript: 'Today we talk about anchoring.' })).toContain('anchoring');
  });
});

describe('truncate', () => {
  it('caps length and is a no-op when short', () => {
    expect(truncate('hello', 100)).toBe('hello');
    expect(truncate('abcdef', 4).length).toBe(4);
  });
});
