import { OnlineConnectInputSchema } from '../db/schemas';
import { createOnlineAttendance } from '../db/online-attendances';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type OnlineConnectEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Pure online-connect pipeline: validate -> Turnstile -> insert -> best-effort notify. */
export async function handleOnlineConnect(env: OnlineConnectEnv, form: FormData, ip?: string): Promise<FormResult> {
  const parsed = OnlineConnectInputSchema.safeParse({
    name: form.get('name'),
    email: form.get('email'),
    location: form.get('location') ?? '',
  });
  if (!parsed.success) return { status: 303, redirect: '/live?connect=err' };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/live?connect=err' };

  await createOnlineAttendance(env.DB, parsed.data);
  await notifyStaff(
    env,
    'New online attendee',
    `${parsed.data.name} (${parsed.data.email}) is watching from ${parsed.data.location || 'unknown'}.`,
  );
  return { status: 303, redirect: '/live?connect=ok' };
}
