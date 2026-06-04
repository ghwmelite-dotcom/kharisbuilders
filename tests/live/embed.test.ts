import { describe, it, expect } from 'vitest';
import { toLiveEmbed } from '../../src/lib/live/embed';

describe('toLiveEmbed', () => {
  it('YouTube video -> embed + chat with embed_domain', () => {
    const r = toLiveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'kharis.org');
    expect(r.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
    expect(r.chatUrl).toBe('https://www.youtube.com/live_chat?v=dQw4w9WgXcQ&embed_domain=kharis.org');
  });
  it('youtu.be and /live/ forms', () => {
    expect(toLiveEmbed('https://youtu.be/dQw4w9WgXcQ', 'h').embedUrl).toContain('/embed/dQw4w9WgXcQ');
    expect(toLiveEmbed('https://www.youtube.com/live/dQw4w9WgXcQ', 'h').embedUrl).toContain('/embed/dQw4w9WgXcQ');
  });
  it('YouTube channel-live -> embed, no chat', () => {
    const r = toLiveEmbed('https://www.youtube.com/embed/live_stream?channel=UC123abc', 'h');
    expect(r.embedUrl).toContain('live_stream?channel=UC123abc');
    expect(r.chatUrl).toBeNull();
  });
  it('Vimeo -> player embed, no chat', () => {
    expect(toLiveEmbed('https://vimeo.com/76979871', 'h').embedUrl).toBe('https://player.vimeo.com/video/76979871');
  });
  it('generic https url -> raw iframe', () => {
    expect(toLiveEmbed('https://stream.example.com/x', 'h').embedUrl).toBe('https://stream.example.com/x');
  });
  it('empty/junk -> nulls', () => {
    expect(toLiveEmbed('', 'h')).toEqual({ embedUrl: null, chatUrl: null });
    expect(toLiveEmbed('not a url', 'h')).toEqual({ embedUrl: null, chatUrl: null });
  });
});
