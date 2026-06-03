import { describe, it, expect } from 'vitest';
import { toEmbedUrl } from '../src/lib/video';

describe('toEmbedUrl', () => {
  it('builds a YouTube embed URL from watch and short links', () => {
    expect(toEmbedUrl('youtube', 'https://www.youtube.com/watch?v=abc123XYZ_-')).toBe(
      'https://www.youtube.com/embed/abc123XYZ_-',
    );
    expect(toEmbedUrl('youtube', 'https://youtu.be/abc123XYZ_-')).toBe('https://www.youtube.com/embed/abc123XYZ_-');
  });

  it('builds a Vimeo embed URL', () => {
    expect(toEmbedUrl('vimeo', 'https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789');
  });

  it('returns null for an unparseable URL', () => {
    expect(toEmbedUrl('youtube', 'https://example.com/nope')).toBeNull();
    expect(toEmbedUrl('vimeo', 'not a url')).toBeNull();
  });
});
