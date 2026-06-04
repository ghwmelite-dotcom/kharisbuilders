// One brand theme. The visual identity is driven by church.config's brand
// anchors (see brandVars + tokens.css), so the data-theme name is just the
// stable selector the tokens hang off — there is no longer a second palette.
export const THEMES = ['purple'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'purple';

export function resolveTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
