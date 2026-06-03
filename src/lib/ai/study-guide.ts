export interface StudyGuide {
  summary: string;
  keyPoints: string[];
  reflectionQuestions: string[];
  relatedScriptures: string[];
}

export interface GuideSermonMeta {
  title: string;
  speaker?: string | null;
  scripture_ref?: string | null;
}

export function buildStudyGuideMessages(meta: GuideSermonMeta, text: string): { role: string; content: string }[] {
  const system =
    'You are a helpful assistant for a Christian church. From the sermon provided, produce a concise study guide ' +
    'as STRICT JSON with exactly these keys: "summary" (2-3 sentence string), "key_points" (array of 3-5 short strings), ' +
    '"reflection_questions" (array of 3-4 strings), "related_scriptures" (array of scripture references as strings). ' +
    'Output ONLY the JSON object, no prose, no code fences.';
  const user = `Sermon: ${meta.title}${meta.scripture_ref ? ` (${meta.scripture_ref})` : ''}\n\n${text}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim()) : [];
}

/** Always returns a valid StudyGuide. Tolerates prose/fences and missing keys. */
export function parseStudyGuide(raw: string): StudyGuide {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(s) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  let obj = tryParse(raw.trim());
  if (!obj) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (!obj) {
    return { summary: raw.trim().slice(0, 1000), keyPoints: [], reflectionQuestions: [], relatedScriptures: [] };
  }
  return {
    summary: typeof obj.summary === 'string' ? obj.summary.trim() : '',
    keyPoints: asStringArray(obj.key_points),
    reflectionQuestions: asStringArray(obj.reflection_questions),
    relatedScriptures: asStringArray(obj.related_scriptures),
  };
}
