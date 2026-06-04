import { contentDefaults } from './fields';

const DEFAULTS = contentDefaults();

export type ContentFn = (key: string) => string;

/** Resolve content: stored value (when non-blank) else the registry default else ''. */
export function makeContent(stored: Record<string, string>): ContentFn {
  return (key: string) => {
    const v = stored[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
    return DEFAULTS[key] ?? '';
  };
}
