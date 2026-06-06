import { describe, it, expect } from 'vitest';
import { AREAS, COMMITMENTS, AREA_KEYS, COMMITMENT_KEYS, optionLabel } from '../../src/lib/community/volunteer-options';

describe('volunteer-options', () => {
  it('has unique keys per list', () => {
    for (const list of [AREAS, COMMITMENTS]) {
      const keys = list.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(AREA_KEYS).toContain('kids');
    expect(COMMITMENT_KEYS).toContain('weekly');
  });
  it('optionLabel returns the label, or the key when unknown', () => {
    expect(optionLabel(COMMITMENTS, 'weekly')).toBe('Weekly');
    expect(optionLabel(AREAS, 'zzz')).toBe('zzz');
  });
});
