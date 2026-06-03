/** Unguessable unique transaction reference. DB UNIQUE constraint is the final guard. */
export function makeReference(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `kb_${rand}`;
}

/** Local correlation id for a pending subscription. */
export function makeSubReference(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `kb_sub_${rand}`;
}
