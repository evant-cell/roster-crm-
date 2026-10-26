import { query } from '../lib/db.js';
import { toCsv } from '../lib/csv.js';
import { error } from '../lib/http.js';
import { todayChicago } from '../lib/dates.js';

const HEADERS = [
  'name', 'company', 'email', 'phone', 'stage', 'last_contacted', 'next_followup',
  'source', 'est_value', 'tags', 'notes',
];
// Extra column saying which tab each record is on.
const LIST_HEADER = 'list';

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

  // Custom fields from Settings become extra columns, labelled by their name.
  let customFields = [];
  try {
    const rows = await query(env, 'settings', { select: 'value', filters: ['key=eq.custom_fields'], limit: 1 });
    if (rows && rows[0] && Array.isArray(rows[0].value)) customFields = rows[0].value;
  } catch {
    // Export the default columns if settings can't be read.
  }

  const rows = leads.map((lead) => {
    const base = HEADERS.map((h) => {
      const v = lead[h];
      if (Array.isArray(v)) return v.join(', ');
      return v == null ? '' : v;
    });
    const custom = customFields.map((f) => {
      const v = (lead.custom || {})[f.key];
      return v == null ? '' : v;
    });
    return base.concat(custom, [lead.is_contact ? 'Contact' : 'Lead']);
  });

  const csv = toCsv(HEADERS.concat(customFields.map((f) => f.label), [LIST_HEADER]), rows);
  const filename = `roster-leads-${todayChicago()}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
