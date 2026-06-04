import type { ChurchTheme } from './church';

/** CSS custom properties that anchor the theme; injected once into :root by the layouts. */
export function brandVars(theme: ChurchTheme): string {
  return [
    `--brand-primary: ${theme.primary}`,
    `--brand-accent: ${theme.accent}`,
    `--brand-dark: ${theme.dark}`,
    `--brand-surface: ${theme.surface}`,
  ].join('; ');
}
