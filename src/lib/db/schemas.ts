import { z } from 'zod';

export const VisitorInputSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  visiting_service: z.string().trim().max(120).optional().or(z.literal('')),
});

export type VisitorInput = z.infer<typeof VisitorInputSchema>;
