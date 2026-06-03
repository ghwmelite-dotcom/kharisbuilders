export interface NotifyEnv {
  RESEND_API_KEY?: string;
  STAFF_EMAIL?: string;
  FROM_EMAIL?: string;
}

/**
 * Best-effort staff email via Resend. No-ops when no provider is configured, and
 * never throws — a failed notification must never block a visitor submission.
 */
export async function notifyStaff(env: NotifyEnv, subject: string, body: string): Promise<void> {
  const key = env.RESEND_API_KEY;
  const to = env.STAFF_EMAIL;
  const from = env.FROM_EMAIL ?? 'no-reply@kharisbuilders.org';
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
  } catch {
    // swallow — the submission already succeeded; platform logs capture the failure
  }
}
