import { describe, it, expect } from 'vitest';
import { renderMarkdown, deriveExcerpt, readMinutes } from '../../src/lib/blog/markdown';

describe('renderMarkdown', () => {
  it('renders markdown to html', () => {
    const html = renderMarkdown('# Hi\n\nHello **world**');
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).toContain('<strong>world</strong>');
  });
  it('adds lazy-loading + async decoding to images', () => {
    const html = renderMarkdown('![alt](/media/blog/a.webp)');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('src="/media/blog/a.webp"');
  });
  it('strips dangerous markup (script tags + event handlers)', () => {
    const html = renderMarkdown('Hi\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });
  it('neutralises javascript: href', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toMatch(/href\s*=\s*["']?\s*javascript:/i);
  });
  it('strips <base> and <meta> tags', () => {
    const html = renderMarkdown('<base href="https://evil.com/">\n\n<meta http-equiv="refresh" content="0">');
    expect(html).not.toContain('<base');
    expect(html).not.toContain('http-equiv');
  });
  it('neutralises data: URIs in href', () => {
    const html = renderMarkdown('<a href="data:text/html,evil">x</a>');
    expect(html).not.toMatch(/href\s*=\s*["']?\s*data:/i);
  });
  it('neutralises UNQUOTED javascript:/data: URIs in href', () => {
    const html = renderMarkdown('<a href=javascript:alert(1)>x</a>\n\n<img src=data:text/html,evil>');
    expect(html).not.toMatch(/href\s*=\s*javascript:/i);
    expect(html).not.toMatch(/src\s*=\s*data:/i);
  });
});

describe('deriveExcerpt', () => {
  it('strips markdown and truncates to ~30 words with an ellipsis', () => {
    const body = '# Heading\n\n' + Array.from({ length: 50 }, (_, i) => `word${i + 1}`).join(' ');
    const ex = deriveExcerpt(body);
    expect(ex.startsWith('word1 word2')).toBe(true);
    expect(ex).not.toContain('#');
    expect(ex.endsWith('…')).toBe(true);
    expect(ex.split(' ').length).toBeLessThanOrEqual(31); // 30 words + ellipsis token
  });
  it('does not append an ellipsis for short bodies', () => {
    expect(deriveExcerpt('Just three words')).toBe('Just three words');
  });
  it('preserves intra-word hyphens', () => {
    expect(deriveExcerpt('state-of-the-art design principles')).toBe('state-of-the-art design principles');
  });
});

describe('readMinutes', () => {
  it('estimates ~200 wpm, minimum 1', () => {
    expect(readMinutes('one two three')).toBe(1);
    expect(readMinutes(Array.from({ length: 400 }, () => 'w').join(' '))).toBe(2);
  });
  it('returns 1 for empty or whitespace-only input', () => {
    expect(readMinutes('')).toBe(1);
    expect(readMinutes('   ')).toBe(1);
  });
});
