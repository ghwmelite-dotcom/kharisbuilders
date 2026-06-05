import type { Sermon } from '../db/sermons';
import { composeSermonText, truncate } from './text';

export interface Context {
  n: number;
  slug: string;
  title: string;
  speaker: string | null;
  scripture_ref: string | null;
  text: string;
}

export interface Citation {
  slug: string;
  title: string;
  speaker: string | null;
  scripture_ref: string | null;
}

export interface SelectOpts {
  maxSermons?: number;
  perSermonChars?: number;
}

/** Turn retrieved sermons into numbered, truncated context blocks for the prompt. */
export function selectContexts(sermons: Sermon[], opts: SelectOpts = {}): Context[] {
  const maxSermons = opts.maxSermons ?? 4;
  const perSermonChars = opts.perSermonChars ?? 1200;
  return sermons.slice(0, maxSermons).map((s, i) => ({
    n: i + 1,
    slug: s.slug,
    title: s.title,
    speaker: s.speaker,
    scripture_ref: s.scripture_ref,
    text: truncate(composeSermonText(s), perSermonChars),
  }));
}
