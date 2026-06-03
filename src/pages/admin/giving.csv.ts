import type { APIRoute } from 'astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listDonations } from '../../lib/db/donations';
import { fromMinorUnits } from '../../lib/giving/money';

function csvCell(v: string | number | null): string {
  let s = v == null ? '' : String(v);
  // Neutralize spreadsheet formula injection (=, +, -, @, tab/CR triggers) by prefixing a quote.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET: APIRoute = async ({ request }) => {
  const email = getAdminEmail(request, env, import.meta.env.DEV);
  if (!email) return new Response('Forbidden', { status: 403 });
  const rows = await listDonations(env.DB, { limit: 10000, offset: 0 }).catch(() => []);
  const header = ['reference', 'created_at', 'name', 'email', 'amount', 'currency', 'status', 'channel', 'fund_id'];
  const lines = [header.join(',')];
  for (const d of rows) {
    lines.push(
      [d.reference, d.created_at, d.name, d.email, fromMinorUnits(d.amount).toFixed(2), d.currency, d.status, d.channel, d.fund_id]
        .map(csvCell)
        .join(','),
    );
  }
  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="donations.csv"',
    },
  });
};
