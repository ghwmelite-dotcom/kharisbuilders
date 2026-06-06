import { VolunteerSignupInputSchema } from '../db/schemas';
import { getRoleById } from '../db/volunteer-roles';
import { createVolunteerSignup } from '../db/volunteer-signups';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type VolunteerEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Pure volunteer-signup pipeline: validate -> role exists+published -> Turnstile -> insert -> best-effort notify. */
export async function handleVolunteerSignup(env: VolunteerEnv, form: FormData, ip?: string): Promise<FormResult> {
  const parsed = VolunteerSignupInputSchema.safeParse({
    role_id: form.get('role_id'),
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone') ?? '',
    message: form.get('message') ?? '',
  });
  if (!parsed.success) return { status: 303, redirect: '/serve?signup=err' };

  const role = await getRoleById(env.DB, parsed.data.role_id);
  if (!role || !role.published) return { status: 303, redirect: '/serve?signup=err' };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/serve?signup=err' };

  await createVolunteerSignup(env.DB, {
    role_id: role.id,
    role_name: role.name,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? '',
    message: parsed.data.message ?? '',
  });
  await notifyStaff(env, 'New volunteer signup', `${parsed.data.name} (${parsed.data.email}) wants to serve in ${role.name}`);
  return { status: 303, redirect: '/serve?signup=ok' };
}
