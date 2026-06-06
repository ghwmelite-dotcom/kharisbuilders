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
  community: boolean;
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
  name: 'Kharisbuilders',
  tagline: 'Building Lives, Shaping Destinies.',
  description:
    'Kharisbuilders is a modern, Christ-centred church — sermons, events, ministries, and a place to belong. Building Lives, Shaping Destinies.',
  url: 'https://church.ohwpstudios.org',
  logo: '/images/kharis-logo.png',
  ogImage: '/images/home-1.jpg',
  locale: 'en',
  currency: 'GHS',
  timezoneOffsetMin: 0, // Accra / UTC
  motifs: true, // Adinkra + kente flourishes
  theme: { primary: '#4a2a6b', accent: '#a87f2e', dark: '#2c1745', surface: '#faf6fe' },
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true, community: true },
};

export function feature(name: keyof ChurchFeatures): boolean {
  return CHURCH.features[name];
}
