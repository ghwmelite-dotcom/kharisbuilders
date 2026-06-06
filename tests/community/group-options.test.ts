import { describe, it, expect } from 'vitest';
import { DAYS, FORMATS, AUDIENCES, FORMAT_KEYS, AUDIENCE_KEYS, optionLabel } from '../../src/lib/community/group-options';

describe('group-options', () => {
  it('has unique keys per list', () => {
    for (const list of [DAYS, FORMATS, AUDIENCES]) {
      const keys = list.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(FORMAT_KEYS).toContain('in_person');
    expect(AUDIENCE_KEYS).toContain('everyone');
  });
  it('optionLabel returns the label, or the key when unknown', () => {
    expect(optionLabel(FORMATS, 'in_person')).toBe('In person');
    expect(optionLabel(AUDIENCES, 'zzz')).toBe('zzz');
  });
});
