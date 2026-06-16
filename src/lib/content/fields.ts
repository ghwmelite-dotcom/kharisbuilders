export type FieldType = 'text' | 'textarea' | 'url' | 'image';
export interface ContentField {
  key: string;
  label: string;
  type: FieldType;
  default: string;
  help?: string;
}
export interface ContentGroup {
  title: string;
  fields: ContentField[];
}
export interface ContentPage {
  slug: 'home' | 'about' | 'visit' | 'pages';
  title: string;
  groups: ContentGroup[];
}

import { PLACEHOLDER } from '../images';

export const CONTENT_PAGES: ContentPage[] = [
  {
    slug: 'home',
    title: 'Home',
    groups: [
      {
        title: 'Hero',
        fields: [
          { key: 'home.hero_kicker', label: 'Eyebrow', type: 'text', default: 'You Belong Here' },
          { key: 'home.hero_line1', label: 'Headline line 1', type: 'text', default: 'Built on' },
          { key: 'home.hero_line2', label: 'Headline line 2 (gold)', type: 'text', default: 'Grace.' },
          { key: 'home.cta1_label', label: 'Button 1 label', type: 'text', default: 'Plan a Visit' },
          { key: 'home.cta1_href', label: 'Button 1 link', type: 'url', default: '/visit' },
          { key: 'home.cta2_label', label: 'Button 2 label', type: 'text', default: 'Watch Online' },
          { key: 'home.cta2_href', label: 'Button 2 link', type: 'url', default: '/sermons' },
          {
            key: 'home.gathering_schedule',
            label: 'Countdown schedule (JSON)',
            type: 'textarea',
            help: 'Array of {day:0-6 (0=Sun), hour:0-23, min, label}. The hero counts down to the soonest.',
            default:
              '[{"day":0,"hour":9,"min":0,"label":"Sunday · 9:00 AM"},{"day":0,"hour":17,"min":30,"label":"Sunday · 5:30 PM"},{"day":3,"hour":19,"min":0,"label":"Wednesday · 7:00 PM"}]',
          },
        ],
      },
      {
        title: 'Pastor welcome',
        fields: [
          { key: 'home.pastor_eyebrow', label: 'Eyebrow', type: 'text', default: 'A Word of Welcome' },
          { key: 'home.pastor_heading', label: 'Heading', type: 'text', default: 'A Message from Our Pastor' },
          {
            key: 'home.pastor_body1',
            label: 'Paragraph 1',
            type: 'textarea',
            default:
              "Welcome! Whether you're exploring faith for the first time or looking for a church to call home, we're so glad you found us. Our prayer is that you'd encounter God's love and find a community that truly knows and cares for you.",
          },
          {
            key: 'home.pastor_body2',
            label: 'Paragraph 2',
            type: 'textarea',
            default:
              "There's a place for you here — come as you are. We'd love to meet you this weekend and help you take your next step in faith.",
          },
          { key: 'home.pastor_name', label: 'Signature', type: 'text', default: 'Lead Pastor' },
        ],
      },
      {
        title: 'Scripture band',
        fields: [
          {
            key: 'home.scripture_verse',
            label: 'Verse',
            type: 'textarea',
            help: 'Quotation marks are added automatically.',
            default: 'For where two or three gather in my name, there am I with them.',
          },
          { key: 'home.scripture_ref', label: 'Reference', type: 'text', default: 'Matthew 18:20' },
        ],
      },
      {
        title: 'Giving banner',
        fields: [
          { key: 'home.giving_eyebrow', label: 'Eyebrow', type: 'text', default: 'Generosity' },
          { key: 'home.giving_heading', label: 'Heading', type: 'text', default: 'Give Generously' },
          {
            key: 'home.giving_body',
            label: 'Body',
            type: 'textarea',
            default:
              'Your generosity helps us serve our community, support those in need, and share hope near and far. Thank you for partnering with us.',
          },
          { key: 'home.giving_cta1_label', label: 'Button 1 label', type: 'text', default: 'Give Online' },
          { key: 'home.giving_cta2_label', label: 'Button 2 label', type: 'text', default: 'Plan a Visit' },
        ],
      },
      {
        title: 'Images',
        fields: [
          { key: 'home.hero_image', label: 'Hero background', type: 'image', default: PLACEHOLDER.wide },
          { key: 'home.pastor_image', label: 'Pastor photo', type: 'image', default: PLACEHOLDER.portrait },
          { key: 'home.scripture_image', label: 'Scripture band background', type: 'image', default: PLACEHOLDER.wide },
          { key: 'home.giving_image', label: 'Giving band background', type: 'image', default: PLACEHOLDER.wide },
        ],
      },
    ],
  },
  {
    slug: 'about',
    title: 'About',
    groups: [
      {
        title: 'Hero',
        fields: [
          { key: 'about.hero_kicker', label: 'Eyebrow', type: 'text', default: 'Who We Are' },
          { key: 'about.hero_title', label: 'Title', type: 'text', default: 'A Community of Faith, Hope, and Love' },
        ],
      },
      {
        title: 'Vision & Mission',
        fields: [
          { key: 'about.vision_heading', label: 'Vision heading', type: 'text', default: 'Our Vision' },
          {
            key: 'about.vision_body',
            label: 'Vision text',
            type: 'textarea',
            default:
              'To be a welcoming family where people from every walk of life encounter God, grow in faith, and are equipped to make a difference in their community and the world.',
          },
          { key: 'about.mission_heading', label: 'Mission heading', type: 'text', default: 'Our Mission' },
          {
            key: 'about.mission_body',
            label: 'Mission text',
            type: 'textarea',
            default:
              'We exist to help people know God, find genuine community, discover their purpose, and make a difference — through worship, teaching, and serving together.',
          },
        ],
      },
      {
        title: 'Images',
        fields: [
          { key: 'about.hero_image', label: 'Hero background', type: 'image', default: '/images/pages/about.webp' },
          { key: 'about.vision_image', label: 'Vision & Mission image', type: 'image', default: PLACEHOLDER.card },
        ],
      },
    ],
  },
  {
    slug: 'visit',
    title: 'Visit',
    groups: [
      {
        title: 'Hero',
        fields: [
          { key: 'visit.hero_kicker', label: 'Eyebrow', type: 'text', default: 'Plan Your Visit' },
          { key: 'visit.hero_title', label: 'Title', type: 'text', default: 'A Place to Belong' },
          {
            key: 'visit.hero_subtitle',
            label: 'Subtitle',
            type: 'textarea',
            default: "We can't wait to meet you. Here's everything you need to know before your first visit.",
          },
        ],
      },
      {
        title: 'Plan Your Visit card',
        fields: [
          { key: 'visit.plan_eyebrow', label: 'Eyebrow', type: 'text', default: 'First Time?' },
          { key: 'visit.plan_heading', label: 'Heading', type: 'text', default: 'Plan Your Visit' },
          {
            key: 'visit.plan_body',
            label: 'Body',
            type: 'textarea',
            default: "Let us know you're coming so we can have a welcome pack ready and help you find your way.",
          },
          {
            key: 'visit.parking_body',
            label: 'Parking note',
            type: 'textarea',
            default: 'Free on-site parking is available, with assistance for those who need it.',
          },
        ],
      },
      {
        title: 'What to Expect',
        fields: [
          { key: 'visit.expect_eyebrow', label: 'Eyebrow', type: 'text', default: 'Your First Visit' },
          { key: 'visit.expect_heading', label: 'Heading', type: 'text', default: 'What to Expect' },
          { key: 'visit.expect_q1_title', label: 'Card 1 title', type: 'text', default: 'What should I wear?' },
          {
            key: 'visit.expect_q1_body',
            label: 'Card 1 body',
            type: 'textarea',
            default:
              "Come as you are. You'll find some people dressed up and others in jeans — wear whatever makes you feel comfortable.",
          },
          { key: 'visit.expect_kids_title', label: 'Card 2 title', type: 'text', default: 'Kids?' },
          {
            key: 'visit.expect_kids_body',
            label: 'Card 2 body',
            type: 'textarea',
            default:
              'We offer a safe, fun, and caring environment for children during the service, with trained and screened volunteers.',
          },
          { key: 'visit.expect_service_title', label: 'Card 3 title', type: 'text', default: 'The Service?' },
          {
            key: 'visit.expect_service_body',
            label: 'Card 3 body',
            type: 'textarea',
            default:
              'Services last about 75 minutes — uplifting music, prayer, and a practical, encouraging message from the Bible.',
          },
          { key: 'visit.expect_afterward_title', label: 'Card 4 title', type: 'text', default: 'Afterward' },
          {
            key: 'visit.expect_afterward_body',
            label: 'Card 4 body',
            type: 'textarea',
            default: "Stay for coffee and a chance to meet our team — we'd love to say hello and answer any questions.",
          },
        ],
      },
      {
        title: 'Images',
        fields: [
          { key: 'visit.hero_image', label: 'Hero background', type: 'image', default: '/images/pages/visit.webp' },
          { key: 'visit.afterward_image', label: '"Afterward" image', type: 'image', default: PLACEHOLDER.card },
        ],
      },
    ],
  },
  {
    slug: 'pages',
    title: 'Other Pages',
    groups: [
      {
        title: 'Hero backgrounds',
        fields: [
          { key: 'pages.sermons_hero', label: 'Sermons hero', type: 'image', default: '/images/pages/sermons.webp' },
          { key: 'pages.events_hero', label: 'Events hero', type: 'image', default: '/images/pages/events.webp' },
          { key: 'pages.ministries_hero', label: 'Ministries hero', type: 'image', default: '/images/pages/ministries.webp' },
          { key: 'pages.giving_hero', label: 'Giving hero', type: 'image', default: '/images/pages/giving.webp' },
        ],
      },
    ],
  },
];

export function contentDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const page of CONTENT_PAGES) for (const g of page.groups) for (const f of g.fields) out[f.key] = f.default;
  return out;
}

export function contentKeySet(): Set<string> {
  return new Set(Object.keys(contentDefaults()));
}

export function getContentPage(slug: string): ContentPage | undefined {
  return CONTENT_PAGES.find((p) => p.slug === slug);
}
