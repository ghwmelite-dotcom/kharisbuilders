import type { APIRoute } from 'astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listConnections } from '../../lib/db/connections';

function csvCell(v: string | number | null): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET: APIRoute = async ({ request }) => {
  const email = getAdminEmail(request, env, import.meta.env.DEV);
  if (!email) return new Response('Forbidden', { status: 403 });
  const rows = await listConnections(env.DB, 10000).catch(() => []);
  const header = ['created_at', 'name', 'email', 'phone', 'steps', 'message', 'status'];
  const lines = [header.join(',')];
  for (const c of rows) {
    lines.push([c.created_at, c.name, c.email, c.phone ?? '', c.steps.join('; '), c.message ?? '', c.status].map(csvCell).join(','));
  }
  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="connections.csv"',
    },
  });
};
