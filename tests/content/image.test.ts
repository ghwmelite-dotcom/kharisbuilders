import { describe, it, expect } from 'vitest';
import { CONTENT_PAGES, contentDefaults } from '../../src/lib/content/fields';
import { makeImage } from '../../src/lib/content/content';

describe('image fields in registry', () => {
  it('every image field defaults to a placeholder SVG asset', () => {
    const defaults = contentDefaults();
    const imageKeys = CONTENT_PAGES.flatMap((p) => p.groups.flatMap((g) => g.fields)).filter((f) => f.type === 'image');
    expect(imageKeys.length).toBeGreaterThanOrEqual(10);
    for (const f of imageKeys) expect(defaults[f.key]).toMatch(/^\/images\/.+\.svg$/);
  });
  it('includes the Other Pages group', () => {
    expect(CONTENT_PAGES.some((p) => p.slug === 'pages')).toBe(true);
  });
});

describe('makeImage', () => {
  it('returns the placeholder default when nothing is uploaded', () => {
    expect(makeImage({})('home.hero_image')).toBe('/images/placeholder-wide.svg');
  });
  it('serves an uploaded R2 key via /media', () => {
    expect(makeImage({ 'home.hero_image': 'page/abc.jpg' })('home.hero_image')).toBe('/media/page/abc.jpg');
  });
  it('passes through an absolute path stored value (does NOT /media-wrap it)', () => {
    // Regression: a bundled default captured into D1 (e.g. via the Kharis backfill) must render as-is,
    // not become /media//images/... which 404s.
    expect(makeImage({ 'home.hero_image': '/images/home-1.jpg' })('home.hero_image')).toBe('/images/home-1.jpg');
    expect(makeImage({ 'home.hero_image': 'https://cdn.example.com/x.jpg' })('home.hero_image')).toBe(
      'https://cdn.example.com/x.jpg',
    );
  });
  it('falls back to default for a blank stored value', () => {
    expect(makeImage({ 'home.hero_image': '  ' })('home.hero_image')).toBe('/images/placeholder-wide.svg');
  });
});
