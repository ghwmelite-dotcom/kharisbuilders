export const THEMES = ['sacred', 'purple'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'sacred';

export function resolveTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
