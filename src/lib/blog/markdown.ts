import { marked } from 'marked';

/**
 * Render admin-authored Markdown to HTML for public display.
 *
 * Authorship is restricted to authenticated admins, so this is a trusted input;
 * the sanitisation below is defence-in-depth, not the primary trust boundary.
 * Rendering happens server-side only — nothing here ships to the browser.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { gfm: true, breaks: false, async: false }) as string;
  return sanitize(addImageLoading(html));
}

/** Inject lazy-loading + async decoding into every <img> that doesn't already carry a loading= attribute. */
function addImageLoading(html: string): string {
  return html.replace(/<img(?![^>]*\bloading=)\s/gi, '<img loading="lazy" decoding="async" ');
}

/** Strip dangerous tags (including their content), inline event handlers, and dangerous URI schemes. */
function sanitize(html: string): string {
  return html
    // Remove entire block tags including their inner content
    .replace(/<(?:script|style|iframe|object|embed|base|form|meta)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|base|form|meta)>/gi, '')
    // Remove any remaining self-closing or orphaned opening/closing tags
    .replace(/<\/?(?:script|style|iframe|object|embed|base|form|meta)\b[^>]*>/gi, '')
    // Strip inline event handlers (quoted and unquoted variants)
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    // Neutralise javascript:/data: URIs in quoted href/src attributes
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .replace(/(href|src)\s*=\s*("|')\s*data:[^"']*\2/gi, '$1=$2#$2')
    // ...and in UNQUOTED href/src attributes (e.g. <a href=javascript:alert(1)>)
    .replace(/(href|src)\s*=\s*(?!["'])\s*(?:javascript|data):[^\s>]*/gi, '$1=#');
}

/** Strip markdown syntax and return the first ~`words` words, with an ellipsis if truncated. */
export function deriveExcerpt(body: string, words = 30): string {
  const text = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')           // code fences
    .replace(/^#{1,6}\s+.*$/gm, ' ')           // ATX headings (entire line)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')      // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // links -> link text
    .replace(/^\s*[-*+]\s+/gm, ' ')               // leading list-marker hyphens/bullets
    .replace(/[>*_`~]/g, ' ')                     // remaining markdown punctuation (preserves intra-word hyphens)
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const parts = text.split(' ');
  if (parts.length <= words) return text;
  return parts.slice(0, words).join(' ') + '…';
}

/** Estimate reading time in minutes (~200 wpm), minimum 1. */
export function readMinutes(body: string): number {
  const count = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(count / 200));
}
