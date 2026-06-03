import { RegistrationInputSchema } from './db/schemas';
import { createRegistration, countRegistrations } from './db/registrations';
import { getEventForRegistration } from './db/events';
import { verifyTurnstile } from './turnstile';
import { notifyStaff, type NotifyEnv } from './notify';

export interface RegisterResult {
  status: number;
  redirect?: string;
}

export type RegisterHandlerEnv = NotifyEnv & {
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
};

/**
 * Pure event-registration pipeline (no Astro/Worker imports, so it is unit-testable):
 * validate input → validate event (exists, published, registration enabled) → Turnstile →
 * capacity check → insert → best-effort notify. The event is validated in app code because
 * D1's foreign key is not enforced at runtime.
 */
export async function handleRegister(env: RegisterHandlerEnv, form: FormData, ip?: string): Promise<RegisterResult> {
  const parsed = RegistrationInputSchema.safeParse({
    event_id: form.get('event_id'),
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone') ?? '',
    guests: form.get('guests') ?? '0',
  });
  if (!parsed.success) return { status: 400 };

  const ev = await getEventForRegistration(env.DB, parsed.data.event_id);
  if (!ev || !ev.published || !ev.registration_enabled) return { status: 400 };

  const ok = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY ?? '',
    String(form.get('cf-turnstile-response') ?? ''),
    ip,
  );
  if (!ok) return { status: 400 };

  if (ev.capacity != null) {
    const taken = await countRegistrations(env.DB, ev.id);
    const requested = parsed.data.guests + 1;
    if (taken + requested > ev.capacity) return { status: 409, redirect: `/events/${ev.slug}?full=1` };
  }

  await createRegistration(env.DB, parsed.data);
  await notifyStaff(
    env,
    'New event registration',
    `${parsed.data.name} (${parsed.data.email}) registered for event #${ev.id} with ${parsed.data.guests} guest(s).`,
  );
  return { status: 303, redirect: `/events/${ev.slug}?registered=1` };
}
