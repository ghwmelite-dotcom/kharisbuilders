import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Render admin-authored Markdown to HTML for public display.
 *
 * Authorship is restricted to authenticated admins, so this is a trusted input;
 * the sanitisation below is defence-in-depth, not the primary trust boundary.
 * Rendering happens server-side only — nothing here ships to the browser.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false }) as string;
  return sanitize(addImageLoading(html));
}

/** Inject lazy-loading + async decoding into every <img>. */
function addImageLoading(html: string): string {
  return html.replace(/<img\s/gi, '<img loading="lazy" decoding="async" ');
}

/** Strip script/style/iframe tags (including their content), inline event handlers, and javascript: URLs. */
function sanitize(html: string): string {
  return html
    // Remove entire block tags including their inner content
    .replace(/<(?:script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed)>/gi, '')
    // Remove any remaining self-closing or orphaned opening/closing tags
    .replace(/<\/?(?:script|style|iframe|object|embed)\b[^>]*>/gi, '')
    // Strip inline event handlers (quoted and unquoted variants)
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

/** Strip markdown syntax and return the first ~`words` words, with an ellipsis if truncated. */
export function deriveExcerpt(body: string, words = 30): string {
  const text = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')           // code fences
    .replace(/^#{1,6}\s+.*$/gm, ' ')           // ATX headings (entire line)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')      // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // links -> link text
    .replace(/[>*_`~-]/g, ' ')                   // markdown punctuation (not #, already handled)
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
