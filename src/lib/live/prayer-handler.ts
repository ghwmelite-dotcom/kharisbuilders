import { PrayerInputSchema } from '../db/schemas';
import { createPrayerRequest } from '../db/prayer-requests';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type PrayerEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Pure prayer-request pipeline: validate -> Turnstile -> insert -> best-effort notify. */
export async function handlePrayer(env: PrayerEnv, form: FormData, ip?: string): Promise<FormResult> {
  const parsed = PrayerInputSchema.safeParse({
    name: form.get('name') ?? '',
    email: form.get('email') ?? '',
    request: form.get('request'),
    is_private: form.get('is_private') ?? 'true',
  });
  if (!parsed.success) return { status: 303, redirect: '/live?prayer=err' };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/live?prayer=err' };

  await createPrayerRequest(env.DB, parsed.data);
  await notifyStaff(env, 'New prayer request', `${parsed.data.name || 'Someone'} requested prayer: ${parsed.data.request}`);
  return { status: 303, redirect: '/live?prayer=ok' };
}
