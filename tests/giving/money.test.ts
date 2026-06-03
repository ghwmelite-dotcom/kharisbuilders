import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  formatAmount,
  validateAmount,
  MIN_MAJOR,
  MAX_MAJOR,
} from '../../src/lib/giving/money';

describe('toMinorUnits / fromMinorUnits', () => {
  it('converts major to integer minor units (rounding)', () => {
    expect(toMinorUnits(100)).toBe(10000);
    expect(toMinorUnits(50.5)).toBe(5050);
    expect(toMinorUnits(0.1)).toBe(10);
  });
  it('round-trips', () => {
    expect(fromMinorUnits(5050)).toBe(50.5);
  });
});

describe('formatAmount', () => {
  it('formats minor units with currency + 2dp', () => {
    expect(formatAmount(10000, 'GHS')).toBe('GHS 100.00');
    expect(formatAmount(5050)).toBe('GHS 50.50');
  });
});

describe('validateAmount', () => {
  it('accepts a valid amount and returns minor units', () => {
    expect(validateAmount('100')).toEqual({ ok: true, minor: 10000 });
    expect(validateAmount('50.50')).toEqual({ ok: true, minor: 5050 });
    expect(validateAmount('1,000')).toEqual({ ok: true, minor: 100000 });
  });
  it('rejects non-numeric / NaN / negative', () => {
    expect(validateAmount('abc').ok).toBe(false);
    expect(validateAmount('').ok).toBe(false);
    expect(validateAmount('-5').ok).toBe(false);
  });
  it('enforces min and max', () => {
    expect(validateAmount(String(MIN_MAJOR - 0.5)).ok).toBe(false);
    expect(validateAmount(String(MAX_MAJOR + 1)).ok).toBe(false);
    expect(validateAmount(String(MIN_MAJOR)).ok).toBe(true);
  });
});
