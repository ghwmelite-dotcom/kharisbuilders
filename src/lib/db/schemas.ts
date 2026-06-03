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
  sermon_date: z.string().trim().max(20).optional().or(z.literal('')),
  published: z.coerce.boolean().default(false),
});
export type SermonInput = z.infer<typeof SermonInputSchema>;
