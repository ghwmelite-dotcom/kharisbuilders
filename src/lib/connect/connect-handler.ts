import { ConnectInputSchema } from '../db/schemas';
import { createConnection } from '../db/connections';
import { STEP_KEYS, stepLabel } from './steps';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type ConnectEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Pure connect-card pipeline: validate -> Turnstile -> insert -> best-effort notify. */
export async function handleConnect(env: ConnectEnv, form: FormData, ip?: string): Promise<FormResult> {
  const steps = form.getAll('steps').map(String).filter((k) => STEP_KEYS.includes(k));
  const parsed = ConnectInputSchema.safeParse({
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone') ?? '',
    steps,
    message: form.get('message') ?? '',
  });
  if (!parsed.success) return { status: 303, redirect: '/connect?connect=err' };
  if (parsed.data.steps.length === 0 && !parsed.data.message) return { status: 303, redirect: '/connect?connect=err' };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/connect?connect=err' };

  await createConnection(env.DB, parsed.data);
  const labels = parsed.data.steps.map(stepLabel).join(', ');
  await notifyStaff(env, 'New connect card', `${parsed.data.name} (${parsed.data.email}) — ${labels || 'message only'}`);
  return { status: 303, redirect: '/connect?connect=ok' };
}
