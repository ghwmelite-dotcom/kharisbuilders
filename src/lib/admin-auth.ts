export interface AdminAuthEnv {
  DEV_ADMIN_EMAIL?: string;
}

/**
 * Resolve the signed-in admin's email. In production, Cloudflare Access sets the
 * `Cf-Access-Authenticated-User-Email` header (and is the real gate). In local dev
 * there is no Access, so fall back to `DEV_ADMIN_EMAIL` — but ONLY when `devMode` is
 * true. This means a production build ignores `DEV_ADMIN_EMAIL` even if it is
 * accidentally set as a secret, so it can never bypass Access. Returns null when no
 * identity is available — callers must treat that as "not authenticated".
 */
export function getAdminEmail(request: Request, env: AdminAuthEnv, devMode = false): string | null {
  const headerEmail = request.headers.get('cf-access-authenticated-user-email');
  if (headerEmail) return headerEmail;
  if (devMode && env.DEV_ADMIN_EMAIL) return env.DEV_ADMIN_EMAIL;
  return null;
}
