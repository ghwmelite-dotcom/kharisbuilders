import { GroupInterestInputSchema } from '../db/schemas';
import { getGroupById } from '../db/groups';
import { createGroupInterest } from '../db/group-interests';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type GroupInterestEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Pure group-interest pipeline: validate -> group exists+published -> Turnstile -> insert -> best-effort notify. */
export async function handleGroupInterest(env: GroupInterestEnv, form: FormData, ip?: string): Promise<FormResult> {
  const parsed = GroupInterestInputSchema.safeParse({
    group_id: form.get('group_id'),
    name: form.get('name'),
    email: form.get('email'),
    message: form.get('message') ?? '',
  });
  if (!parsed.success) return { status: 303, redirect: '/groups?interest=err' };

  const group = await getGroupById(env.DB, parsed.data.group_id);
  if (!group || !group.published) return { status: 303, redirect: '/groups?interest=err' };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/groups?interest=err' };

  await createGroupInterest(env.DB, {
    group_id: group.id,
    group_name: group.name,
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message ?? '',
  });
  await notifyStaff(env, 'New group interest', `${parsed.data.name} (${parsed.data.email}) is interested in ${group.name}`);
  return { status: 303, redirect: '/groups?interest=ok' };
}
