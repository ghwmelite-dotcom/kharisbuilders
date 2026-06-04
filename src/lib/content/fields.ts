export type FieldType = 'text' | 'textarea' | 'url';
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
  slug: 'home' | 'about' | 'visit';
  title: string;
  groups: ContentGroup[];
}

export const CONTENT_PAGES: ContentPage[] = [
  {
    slug: 'home',
    title: 'Home',
    groups: [
      {
        title: 'Hero',
        fields: [
          { key: 'home.hero_kicker', label: 'Eyebrow', type: 'text', default: 'Welcome Home' },
          { key: 'home.hero_line1', label: 'Headline line 1', type: 'text', default: 'Building Lives,' },
          { key: 'home.hero_line2', label: 'Headline line 2 (gold)', type: 'text', default: 'Shaping Destinies.' },
          { key: 'home.cta1_label', label: 'Button 1 label', type: 'text', default: 'Join Us This Sunday' },
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
              'Welcome to Kharisbuilders. We believe that every individual has a divine blueprint — a destiny waiting to be realized. Our mission is to provide the spiritual foundation and community support needed to build that life.',
          },
          {
            key: 'home.pastor_body2',
            label: 'Paragraph 2',
            type: 'textarea',
            default:
              'Whether you are exploring faith for the first time or seeking a deeper connection with your Creator, there is a place for you in our sanctuary. We are more than a congregation; we are architects of hope.',
          },
          { key: 'home.pastor_name', label: 'Signature', type: 'text', default: 'Lead Pastor David Anderson' },
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
            default: 'Now faith is the substance of things hoped for, the evidence of things not seen.',
          },
          { key: 'home.scripture_ref', label: 'Reference', type: 'text', default: 'Hebrews 11:1' },
        ],
      },
      {
        title: 'Giving banner',
        fields: [
          { key: 'home.giving_eyebrow', label: 'Eyebrow', type: 'text', default: 'Generosity' },
          { key: 'home.giving_heading', label: 'Heading', type: 'text', default: 'Invest in Destinies' },
          {
            key: 'home.giving_body',
            label: 'Body',
            type: 'textarea',
            default:
              'Your generosity fuels our mission to build lives and shape destinies. Together, we can make an eternal impact on our community and beyond.',
          },
          { key: 'home.giving_cta1_label', label: 'Button 1 label', type: 'text', default: 'Give Online' },
          { key: 'home.giving_cta2_label', label: 'Button 2 label', type: 'text', default: 'Plan a Visit' },
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
          { key: 'about.hero_kicker', label: 'Eyebrow', type: 'text', default: 'Our Identity' },
          { key: 'about.hero_title', label: 'Title', type: 'text', default: 'Architects of Faith, Builders of Destinies' },
        ],
      },
      {
        title: 'Vision & Mission',
        fields: [
          { key: 'about.vision_heading', label: 'Vision heading', type: 'text', default: 'The Vision' },
          {
            key: 'about.vision_body',
            label: 'Vision text',
            type: 'textarea',
            default:
              "To see every life constructed on the unshakeable foundation of grace, transforming individuals into living monuments of God's presence within their spheres of influence.",
          },
          { key: 'about.mission_heading', label: 'Mission heading', type: 'text', default: 'The Mission' },
          {
            key: 'about.mission_body',
            label: 'Mission text',
            type: 'textarea',
            default:
              'We are committed to building people through the precise teaching of the Word, the warmth of communal fellowship, and the strategic deployment of spiritual gifts for societal impact.',
          },
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
            default: "Experience the intersection of tradition and transformation. We can't wait to welcome you home.",
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
            default: 'Free on-site parking is available, with assistance for elderly visitors.',
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
              "We value your presence more than your attire. You'll find some people in suits and others in jeans — wear whatever makes you feel comfortable and ready to connect with the community.",
          },
          { key: 'visit.expect_kids_title', label: 'Card 2 title', type: 'text', default: 'Kids?' },
          {
            key: 'visit.expect_kids_body',
            label: 'Card 2 body',
            type: 'textarea',
            default:
              "Our 'Kharis Kids' program offers a safe, fun, and spiritually enriching environment for ages 2–11 during the morning service.",
          },
          { key: 'visit.expect_service_title', label: 'Card 3 title', type: 'text', default: 'The Service?' },
          {
            key: 'visit.expect_service_body',
            label: 'Card 3 body',
            type: 'textarea',
            default:
              'Services typically last 75 minutes — soulful music, communal prayer, and a message both ancient in truth and modern in application.',
          },
          { key: 'visit.expect_afterward_title', label: 'Card 4 title', type: 'text', default: 'Afterward' },
          {
            key: 'visit.expect_afterward_body',
            label: 'Card 4 body',
            type: 'textarea',
            default: 'Join us in the Glass Atrium for artisanal coffee and a chance to meet our leadership team.',
          },
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
