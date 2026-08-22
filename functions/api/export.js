import { query } from '../lib/db.js';
import { toCsv } from '../lib/csv.js';
import { error } from '../lib/http.js';
import { todayChicago } from '../lib/dates.js';

const HEADERS = [
  'name', 'company', 'email', 'phone', 'stage', 'last_contacted', 'next_followup',
  'source', 'est_value', 'tags', 'notes',
];

export async function onRequestGet({ env }) {
  let leads;
  try {
    leads = await query(env, 'leads', {
      select: '*',
      filters: ['archived_at=is.null'],
      order: 'created_at.desc',
    });
  } catch (e) {
    return error(e.message, 502);
  }

  const rows = leads.map((lead) => HEADERS.map((h) => {
    const v = lead[h];
    if (Array.isArray(v)) return v.join(', ');
    return v == null ? '' : v;
  }));

  const csv = toCsv(HEADERS, rows);
  const filename = `roster-leads-${todayChicago()}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
