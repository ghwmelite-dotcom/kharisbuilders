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

export const FALLBACK_ANSWER =
  "I couldn't find a sermon in our library that speaks directly to that yet. Try rephrasing your question, " +
  'browse the sermons, or reach out to the church — we would love to help you personally.';

/** Build the grounded chat messages. The model must answer ONLY from the numbered excerpts. */
export function buildAskMessages(question: string, contexts: Context[]): { role: string; content: string }[] {
  const system =
    'You are a warm, pastoral assistant for a Christian church. Answer the visitor’s question ONLY using the ' +
    'numbered sermon excerpts provided below. Speak kindly, clearly, and briefly. Cite the sermons you draw from ' +
    'inline using their numbers, like [1] or [2]. If the excerpts do not address the question, say so honestly and ' +
    'gently suggest they contact the church — do NOT use outside knowledge or invent teaching.';
  const blocks = contexts
    .map(
      (c) =>
        `[${c.n}] "${c.title}"${c.speaker ? ` — ${c.speaker}` : ''}${c.scripture_ref ? ` (${c.scripture_ref})` : ''}\n${c.text}`,
    )
    .join('\n\n');
  const user = `Question: ${question}\n\nSermon excerpts:\n${blocks}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
