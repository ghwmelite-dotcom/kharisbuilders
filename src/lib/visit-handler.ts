import { VisitorInputSchema } from './db/schemas';
import { createVisitor } from './db/visitors';
import { verifyTurnstile } from './turnstile';
import { notifyStaff, type NotifyEnv } from './notify';

export interface VisitResult {
  status: number;
  redirect?: string;
}

export type VisitHandlerEnv = NotifyEnv & {
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
};

/**
 * Pure visit-form pipeline (no Astro/Worker imports, so it is unit-testable):
 * validate -> Turnstile -> insert -> best-effort notify. Returns a redirect on success
 * or a 400 on validation/Turnstile failure.
 */
export async function handleVisit(env: VisitHandlerEnv, form: FormData, ip?: string): Promise<VisitResult> {
  const parsed = VisitorInputSchema.safeParse({
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone') ?? '',
    visiting_service: form.get('visiting_service') ?? '',
  });
  if (!parsed.success) return { status: 400 };

  const token = String(form.get('cf-turnstile-response') ?? '');
  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', token, ip);
  if (!ok) return { status: 400 };

  await createVisitor(env.DB, parsed.data);
  await notifyStaff(
    env,
    'New visit planned',
    `${parsed.data.name} (${parsed.data.email}) is planning to visit: ${parsed.data.visiting_service || 'unspecified'}.`,
  );
  return { status: 303, redirect: '/visit?submitted=1' };
}
