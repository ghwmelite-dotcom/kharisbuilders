export interface ChurchTheme {
  primary: string;
  accent: string;
  dark: string;
  surface: string;
}
export interface ChurchFeatures {
  sermons: boolean;
  events: boolean;
  ministries: boolean;
  giving: boolean;
  ai: boolean;
  live: boolean;
}
export interface ChurchConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;
  logo: string;
  ogImage: string;
  locale: string;
  currency: string;
  timezoneOffsetMin: number;
  motifs: boolean;
  theme: ChurchTheme;
  features: ChurchFeatures;
}

/**
 * THE ONE FILE TO CUSTOMISE PER CHURCH.
 * Edit these values + swap the logo/og images to re-skin the whole platform.
 */
export const CHURCH: ChurchConfig = {
  name: 'Grace Community Church',
  tagline: 'A place to belong.',
  description:
    'A welcoming, Christ-centred church — sermons, events, ministries, and a community to call home.',
  url: 'https://example.com',
  logo: '/images/logo-placeholder.svg',
  ogImage: '/images/placeholder-wide.svg',
  locale: 'en',
  currency: 'USD',
  timezoneOffsetMin: 0,
  motifs: false, // Adinkra/kente are Ghana-specific; a church enables them in config
  theme: { primary: '#3b3a6b', accent: '#b08a3e', dark: '#23223f', surface: '#f7f7fb' },
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true },
};

export function feature(name: keyof ChurchFeatures): boolean {
  return CHURCH.features[name];
}
