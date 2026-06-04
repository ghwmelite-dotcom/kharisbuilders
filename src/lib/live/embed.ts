export interface LiveEmbed {
  embedUrl: string | null;
  chatUrl: string | null;
}

/** Convert a stream URL into an embeddable player URL (+ chat URL for YouTube videos). */
export function toLiveEmbed(url: string, originHost: string): LiveEmbed {
  const u = (url ?? '').trim();
  if (!u) return { embedUrl: null, chatUrl: null };

  // YouTube channel-live (note: "live_stream" is 11 chars, so check this BEFORE the video regex)
  const channel = u.match(/youtube\.com\/embed\/live_stream\?channel=([A-Za-z0-9_-]+)/);
  if (channel) {
    return { embedUrl: `https://www.youtube.com/embed/live_stream?channel=${channel[1]}`, chatUrl: null };
  }

  // YouTube video (watch / youtu.be / live / embed)
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    return {
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
      chatUrl: `https://www.youtube.com/live_chat?v=${id}&embed_domain=${originHost}`,
    };
  }

  const vimeo = u.match(/vimeo\.com\/(?:event\/)?(\d+)/);
  if (vimeo) return { embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`, chatUrl: null };

  if (/facebook\.com/.test(u)) {
    return {
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&autoplay=true`,
      chatUrl: null,
    };
  }

  if (/^https?:\/\//i.test(u)) return { embedUrl: u, chatUrl: null };
  return { embedUrl: null, chatUrl: null };
}
