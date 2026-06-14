/** Index of the next slide, wrapping back to 0 after the last. */
export function nextIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}
