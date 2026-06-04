import { contentDefaults } from './fields';
import { mediaUrl } from '../media';

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

export type ImageFn = (key: string) => string;

/** Resolve a page image: uploaded R2 key -> /media URL; else the registry default (bundled path). */
export function makeImage(stored: Record<string, string>): ImageFn {
  return (key: string) => {
    const def = DEFAULTS[key] ?? '';
    const v = stored[key];
    if (typeof v === 'string' && v.trim().length > 0) return mediaUrl(v) ?? def;
    return def;
  };
}
