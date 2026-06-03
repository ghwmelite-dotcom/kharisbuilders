import { describe, it, expect } from 'vitest';
import {
  absUrl,
  toIso,
  organizationJsonLd,
  websiteJsonLd,
  eventJsonLd,
  videoJsonLd,
  breadcrumbJsonLd,
  SITE,
} from '../src/lib/seo';

const origin = 'https://example.org';

describe('absUrl', () => {
  it('joins origin + path and passes through absolute', () => {
    expect(absUrl('/images/x.jpg', origin)).toBe('https://example.org/images/x.jpg');
    expect(absUrl('images/x.jpg', origin)).toBe('https://example.org/images/x.jpg');
    expect(absUrl('https://cdn.com/a.jpg', origin)).toBe('https://cdn.com/a.jpg');
  });
});

describe('toIso', () => {
  it('converts a D1 UTC datetime to ISO 8601 Z', () => {
    expect(toIso('2026-07-01 18:30:00')).toBe('2026-07-01T18:30:00Z');
  });
  it('leaves a date-only value untouched (no spurious Z)', () => {
    expect(toIso('2024-12-01')).toBe('2024-12-01');
  });
  it('returns undefined for empty', () => {
    expect(toIso('')).toBeUndefined();
    expect(toIso(null)).toBeUndefined();
  });
});

describe('organizationJsonLd', () => {
  it('builds a Church node with address + socials', () => {
    const node = organizationJsonLd(origin, {
      address: '12 Cathedral Way, London',
      socials: JSON.stringify({ facebook: 'https://fb.com/kb', instagram: '', youtube: 'https://youtube.com/@kb' }),
      contact_email: 'hello@kb.org',
      phone: '+44 20 7946 0000',
    });
    expect(node['@type']).toBe('Church');
    expect(node.name).toBe(SITE.name);
    expect(node.url).toBe(origin + '/');
    expect(node.logo).toBe(origin + SITE.logo);
    expect((node.address as { streetAddress: string }).streetAddress).toBe('12 Cathedral Way, London');
    expect(node.sameAs).toEqual(['https://fb.com/kb', 'https://youtube.com/@kb']); // empty dropped
    expect(node.email).toBe('hello@kb.org');
  });
  it('omits empty optionals gracefully', () => {
    const node = organizationJsonLd(origin, {});
    expect(node.sameAs).toBeUndefined();
    expect(node.address).toBeUndefined();
  });
});

describe('websiteJsonLd', () => {
  it('builds a WebSite node', () => {
    const node = websiteJsonLd(origin);
    expect(node['@type']).toBe('WebSite');
    expect(node.url).toBe(origin + '/');
    expect(node.name).toBe(SITE.name);
  });
});

describe('eventJsonLd', () => {
  it('builds an Event node with ISO dates and place', () => {
    const node = eventJsonLd(origin, {
      title: 'First Steps Luncheon',
      slug: 'first-steps',
      description: 'A warm welcome',
      start_at: '2026-07-01 12:30:00',
      end_at: '2026-07-01 14:00:00',
      location: 'The Glass Atrium',
      image_key: 'events/abc.jpg',
    });
    expect(node['@type']).toBe('Event');
    expect(node.name).toBe('First Steps Luncheon');
    expect(node.startDate).toBe('2026-07-01T12:30:00Z');
    expect(node.endDate).toBe('2026-07-01T14:00:00Z');
    expect(node.url).toBe(origin + '/events/first-steps');
    expect(node.image).toBe(origin + '/media/events/abc.jpg');
    expect((node.location as { name: string }).name).toBe('The Glass Atrium');
    expect((node.organizer as { name: string }).name).toBe(SITE.name);
  });
});

describe('videoJsonLd', () => {
  it('builds a VideoObject with embedUrl', () => {
    const node = videoJsonLd(origin, {
      title: 'Faith That Builds',
      slug: 'faith-that-builds',
      description: 'Message',
      video_url: 'https://youtu.be/dQw4w9WgXcQ',
      video_provider: 'youtube',
      thumbnail_key: 'sermons/t.jpg',
      sermon_date: '2026-05-04',
    });
    expect(node['@type']).toBe('VideoObject');
    expect(node.name).toBe('Faith That Builds');
    expect(node.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(node.thumbnailUrl).toBe(origin + '/media/sermons/t.jpg');
    expect(node.uploadDate).toBe('2026-05-04');
  });
});

describe('breadcrumbJsonLd', () => {
  it('builds an ordered list', () => {
    const node = breadcrumbJsonLd(origin, [
      { name: 'Home', path: '/' },
      { name: 'Sermons', path: '/sermons' },
    ]);
    expect(node['@type']).toBe('BreadcrumbList');
    expect(node.itemListElement).toHaveLength(2);
    expect((node.itemListElement as unknown[])[1]).toMatchObject({
      position: 2,
      name: 'Sermons',
      item: origin + '/sermons',
    });
  });
});
