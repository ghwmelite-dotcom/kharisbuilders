import { describe, it, expect } from 'vitest';
import { NEXT_STEPS, STEP_KEYS, stepLabel } from '../../src/lib/connect/steps';

describe('next-steps registry', () => {
  it('has unique keys and labels', () => {
    expect(STEP_KEYS.length).toBe(NEXT_STEPS.length);
    expect(new Set(STEP_KEYS).size).toBe(STEP_KEYS.length);
    for (const s of NEXT_STEPS) expect(s.label.length).toBeGreaterThan(0);
    expect(STEP_KEYS).toContain('decision');
    expect(STEP_KEYS).toContain('serve');
  });
  it('stepLabel returns the label, or the key when unknown', () => {
    expect(stepLabel('serve')).toBe('I want to serve / volunteer');
    expect(stepLabel('zzz')).toBe('zzz');
  });
});
