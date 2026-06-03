import type { AIClient } from './clients';
import { composeSermonText, truncate, type SermonTextFields } from './text';
import { contentHash } from './hash';
import { buildStudyGuideMessages, parseStudyGuide, type StudyGuide } from './study-guide';
import { getCachedGuide, upsertGuide } from '../db/study-guides';

export interface GuideSermon extends SermonTextFields {
  id: number;
}

/** Enough material to summarise: a non-trivial description or transcript. */
function hasContent(s: GuideSermon): boolean {
  return (s.description?.trim().length ?? 0) >= 40 || (s.transcript?.trim().length ?? 0) >= 40;
}

/** Cache-or-generate the study guide for a sermon. Returns null when there's too little content. */
export async function getOrGenerateGuide(db: D1Database, ai: AIClient, sermon: GuideSermon): Promise<StudyGuide | null> {
  if (!hasContent(sermon)) return null;
  const text = truncate(composeSermonText(sermon), 6000);
  const hash = await contentHash(text);

  const cached = await getCachedGuide(db, sermon.id);
  if (cached && cached.content_hash === hash) {
    try {
      return JSON.parse(cached.guide_json) as StudyGuide;
    } catch {
      /* fall through to regenerate */
    }
  }

  const raw = await ai.generate(buildStudyGuideMessages(sermon, text));
  const guide = parseStudyGuide(raw);
  await upsertGuide(db, sermon.id, hash, JSON.stringify(guide));
  return guide;
}
