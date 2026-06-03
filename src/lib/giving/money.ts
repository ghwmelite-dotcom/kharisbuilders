export const MIN_MAJOR = 1;
export const MAX_MAJOR = 100_000;

export function toMinorUnits(major: number): number {
  return Math.round(major * 100);
}

export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

export function formatAmount(minor: number, currency = 'GHS'): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export type AmountResult = { ok: true; minor: number } | { ok: false; error: string };

/** Parse a user-entered major-unit amount, validate bounds, return integer minor units. */
export function validateAmount(input: string | number): AmountResult {
  const n = typeof input === 'number' ? input : parseFloat(String(input).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return { ok: false, error: 'Please enter a valid amount.' };
  const rounded = Math.round(n * 100) / 100;
  if (rounded < MIN_MAJOR) return { ok: false, error: `Minimum gift is GHS ${MIN_MAJOR}.` };
  if (rounded > MAX_MAJOR) return { ok: false, error: `Maximum gift is GHS ${MAX_MAJOR.toLocaleString()}.` };
  return { ok: true, minor: Math.round(rounded * 100) };
}
