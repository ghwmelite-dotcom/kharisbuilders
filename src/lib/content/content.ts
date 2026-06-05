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

/** Resolve a page image. A stored value that is already an absolute path/URL (starts with '/'
 *  or 'http') is used as-is — e.g. a bundled default captured in D1; only a bare R2 object key
 *  (e.g. "page/abc.jpg") gets the /media/ prefix. Else the registry default (bundled path). */
export function makeImage(stored: Record<string, string>): ImageFn {
  return (key: string) => {
    const def = DEFAULTS[key] ?? '';
    const v = stored[key];
    if (typeof v === 'string' && v.trim().length > 0) {
      const t = v.trim();
      if (t.startsWith('/') || t.startsWith('http')) return t;
      return mediaUrl(t) ?? def;
    }
    return def;
  };
}
