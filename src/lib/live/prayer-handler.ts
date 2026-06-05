import { PrayerInputSchema } from '../db/schemas';
import { createPrayerRequest } from '../db/prayer-requests';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type PrayerEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Resolve is_private as a real boolean (avoids the z.coerce.boolean('false')===true trap). */
function resolveIsPrivate(form: FormData): boolean {
  const vis = form.get('visibility');
  if (vis != null) return String(vis) !== 'public';
  const ip = form.get('is_private');
  if (ip != null) return String(ip) !== 'false';
  return true;
}

/** Pure prayer-request pipeline: validate -> Turnstile -> insert -> best-effort notify. */
export async function handlePrayer(
  env: PrayerEnv,
  form: FormData,
  ip?: string,
  opts: { page?: string } = {},
): Promise<FormResult> {
  const page = opts.page ?? '/live';
  const parsed = PrayerInputSchema.safeParse({
    name: form.get('name') ?? '',
    email: form.get('email') ?? '',
    request: form.get('request'),
    is_private: resolveIsPrivate(form),
  });
  if (!parsed.success) return { status: 303, redirect: `${page}?prayer=err` };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: `${page}?prayer=err` };

  await createPrayerRequest(env.DB, parsed.data);
  await notifyStaff(env, 'New prayer request', `${parsed.data.name || 'Someone'} requested prayer: ${parsed.data.request}`);
  return { status: 303, redirect: `${page}?prayer=ok` };
}
