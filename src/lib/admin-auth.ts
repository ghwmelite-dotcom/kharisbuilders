export interface AdminAuthEnv {
  DEV_ADMIN_EMAIL?: string;
}

/**
 * Resolve the signed-in admin's email. In production, Cloudflare Access sets the
 * `Cf-Access-Authenticated-User-Email` header (and is the real gate). In local dev
 * there is no Access, so fall back to `DEV_ADMIN_EMAIL`. Returns null when neither
 * is present — callers must treat that as "not authenticated".
 */
export function getAdminEmail(request: Request, env: AdminAuthEnv): string | null {
  const headerEmail = request.headers.get('cf-access-authenticated-user-email');
  if (headerEmail) return headerEmail;
  if (env.DEV_ADMIN_EMAIL) return env.DEV_ADMIN_EMAIL;
  return null;
}
