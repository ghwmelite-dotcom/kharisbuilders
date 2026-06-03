export interface SermonTextFields {
  title: string;
  speaker?: string | null;
  series?: string | null;
  scripture_ref?: string | null;
  description?: string | null;
  transcript?: string | null;
}

/** One text blob representing a sermon, for embedding + study-guide generation. */
export function composeSermonText(s: SermonTextFields): string {
  const parts = [
    s.title,
    s.series ? `Series: ${s.series}` : '',
    s.speaker ? `Speaker: ${s.speaker}` : '',
    s.scripture_ref ? `Scripture: ${s.scripture_ref}` : '',
    s.description ?? '',
    s.transcript ?? '',
  ];
  return parts
    .filter((p) => p && p.trim().length > 0)
    .join('\n')
    .trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}
