import { toEmbedUrl, type VideoProvider } from './video';

export const SITE = {
  name: 'Kharisbuilders',
  /** Live origin today; change when a custom domain is added. Used as fallback when Astro.site is unset. */
  url: 'https://kharisbuilders.missdiasporagh.workers.dev',
  tagline: 'Building Lives, Shaping Destinies.',
  description:
    'Kharisbuilders is a modern, Christ-centred church — sermons, events, ministries, and a place to belong. Building Lives, Shaping Destinies.',
  logo: '/images/kharis-logo.png',
  /** Default social/OG preview image. */
  ogImage: '/images/home-1.jpg',
} as const;

/** Resolve a path (or pass through an absolute URL) against an origin. */
export function absUrl(pathOrUrl: string, origin: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, origin.endsWith('/') ? origin : origin + '/').href;
}

/** D1 UTC datetime "YYYY-MM-DD HH:MM:SS" -> ISO 8601 "…Z". */
export function toIso(dt: string | null | undefined): string | undefined {
  if (!dt) return undefined;
  const trimmed = dt.trim();
  if (!trimmed) return undefined;
  return trimmed.includes('T') ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
}

function parseSocials(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    const urls = Object.values(obj).filter((v) => typeof v === 'string' && v.trim().length > 0);
    return urls.length ? urls : undefined;
  } catch {
    return undefined;
  }
}

export interface OrgSettings {
  address?: string;
  socials?: string;
  contact_email?: string;
  phone?: string;
}

export function organizationJsonLd(origin: string, s: OrgSettings): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    '@id': absUrl('/#church', origin),
    name: SITE.name,
    url: absUrl('/', origin),
    logo: absUrl(SITE.logo, origin),
    description: SITE.description,
  };
  const sameAs = parseSocials(s.socials);
  if (sameAs) node.sameAs = sameAs;
  if (s.address) node.address = { '@type': 'PostalAddress', streetAddress: s.address };
  if (s.contact_email) node.email = s.contact_email;
  if (s.phone) node.telephone = s.phone;
  return node;
}

export function websiteJsonLd(origin: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: absUrl('/', origin),
    description: SITE.description,
  };
}

export interface EventSeo {
  title: string;
  slug: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  image_key?: string | null;
}

export function eventJsonLd(origin: string, e: EventSeo): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    url: absUrl(`/events/${e.slug}`, origin),
    startDate: toIso(e.start_at),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: { '@type': 'Organization', name: SITE.name, url: absUrl('/', origin) },
  };
  const end = toIso(e.end_at);
  if (end) node.endDate = end;
  if (e.description) node.description = e.description;
  if (e.location) node.location = { '@type': 'Place', name: e.location };
  if (e.image_key) node.image = absUrl(`/media/${e.image_key}`, origin);
  return node;
}

export interface SermonSeo {
  title: string;
  slug: string;
  description?: string | null;
  video_url: string;
  video_provider: VideoProvider;
  thumbnail_key?: string | null;
  sermon_date?: string | null;
}

export function videoJsonLd(origin: string, s: SermonSeo): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: s.title,
    url: absUrl(`/sermons/${s.slug}`, origin),
    description: s.description || s.title,
    uploadDate: s.sermon_date || undefined,
    thumbnailUrl: s.thumbnail_key ? absUrl(`/media/${s.thumbnail_key}`, origin) : absUrl(SITE.ogImage, origin),
  };
  const embed = toEmbedUrl(s.video_provider, s.video_url);
  if (embed) node.embedUrl = embed;
  return node;
}

export function breadcrumbJsonLd(origin: string, items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(it.path, origin),
    })),
  };
}
