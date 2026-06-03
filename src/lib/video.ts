export type VideoProvider = 'youtube' | 'vimeo';

/**
 * Convert a YouTube/Vimeo watch URL into an embeddable player URL.
 * Returns null when the id cannot be parsed (caller decides the fallback).
 */
export function toEmbedUrl(provider: VideoProvider, url: string): string | null {
  if (provider === 'youtube') {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  if (provider === 'vimeo') {
    const m = url.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return null;
}
