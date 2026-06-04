import { z } from 'zod';

export const VisitorInputSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  visiting_service: z.string().trim().max(120).optional().or(z.literal('')),
});

export type VisitorInput = z.infer<typeof VisitorInputSchema>;

export const RegistrationInputSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  guests: z.coerce.number().int().min(0).max(20).default(0),
});

export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;

export const SermonInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional().or(z.literal('')),
  speaker: z.string().trim().max(120).optional().or(z.literal('')),
  series: z.string().trim().max(120).optional().or(z.literal('')),
  scripture_ref: z.string().trim().max(120).optional().or(z.literal('')),
  video_url: z.string().trim().url().max(500),
  video_provider: z.enum(['youtube', 'vimeo']).default('youtube'),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  transcript: z.string().trim().max(100000).optional().or(z.literal('')),
  sermon_date: z.string().trim().max(20).optional().or(z.literal('')),
  published: z.coerce.boolean().default(false),
});
export type SermonInput = z.infer<typeof SermonInputSchema>;

export const EventInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional().or(z.literal('')),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  start_at: z.string().trim().min(1).max(30),
  end_at: z.string().trim().max(30).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  registration_enabled: z.coerce.boolean().default(false),
  // Empty field => unlimited (undefined). Preprocess so '' doesn't coerce to 0 and fail positive().
  capacity: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  published: z.coerce.boolean().default(false),
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const OnlineConnectInputSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(200),
  location: z.string().trim().max(120).optional().or(z.literal('')),
});
export type OnlineConnectInput = z.infer<typeof OnlineConnectInputSchema>;

export const PrayerInputSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  request: z.string().trim().min(1, 'Please share your request').max(2000),
  is_private: z.coerce.boolean().default(true),
});
export type PrayerInput = z.infer<typeof PrayerInputSchema>;

export const LeaderInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type LeaderInput = z.infer<typeof LeaderInputSchema>;

export const JourneyInputSchema = z.object({
  year: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type JourneyInput = z.infer<typeof JourneyInputSchema>;

export const HomeCardInputSchema = z.object({
  eyebrow: z.string().trim().max(80).optional().or(z.literal('')),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional().or(z.literal('')),
  href: z.string().trim().min(1).max(200),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type HomeCardInput = z.infer<typeof HomeCardInputSchema>;

export const FundInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
  // default(false): an unchecked checkbox is ABSENT from the form, so it must
  // resolve to false. FundForm checks the box by default on NEW funds (so a new
  // fund is active); unchecking on edit correctly deactivates.
  active: z.coerce.boolean().default(false),
});
export type FundInput = z.infer<typeof FundInputSchema>;

export const DonationInputSchema = z.object({
  email: z.string().trim().email('Please enter a valid email').max(200),
  name: z.string().trim().max(120).optional().or(z.literal('')),
  amount: z.string().trim().min(1, 'Please enter an amount'),
  fund_id: z.coerce.number().int().positive().optional(),
});
export type DonationInput = z.infer<typeof DonationInputSchema>;

export const MinistryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().min(1).max(2000),
  leader: z.string().trim().max(120).optional().or(z.literal('')),
  meeting_time: z.string().trim().max(120).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
  published: z.coerce.boolean().default(false),
});
export type MinistryInput = z.infer<typeof MinistryInputSchema>;
