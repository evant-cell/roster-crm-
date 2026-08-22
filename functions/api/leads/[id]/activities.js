import { query, update, insert } from '../../../lib/db.js';
import { json, error, readJson } from '../../../lib/http.js';
import { todayChicago } from '../../../lib/dates.js';

const TYPES = ['note', 'call', 'email', 'stage', 'import'];

export async function onRequestPost({ request, params, env }) {
  const { id } = params;
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  const type = body.type;
  const activityBody = body.body || '';
  const touch = body.touch !== undefined ? Boolean(body.touch) : true;

  if (!TYPES.includes(type)) return error('Invalid activity type.');

  let leadRows;
  try {
    leadRows = await query(env, 'leads', { select: 'id', filters: [`id=eq.${id}`], limit: 1 });
  } catch (e) {
    return error(e.message, 502);
  }
  if (!leadRows || !leadRows[0]) return error('Lead not found.', 404);

  let activity;
  try {
    const rows = await insert(env, 'activities', [{ lead_id: id, type, body: activityBody }]);
    activity = rows[0];
  } catch (e) {
    return error(e.message, 502);
  }

  let lead;
  try {
    if (touch) {
      const rows = await update(env, 'leads', [`id=eq.${id}`], { last_contacted: todayChicago() });
      lead = rows[0];
    } else {
      const rows = await query(env, 'leads', { select: '*', filters: [`id=eq.${id}`], limit: 1 });
      lead = rows[0];
    }
  } catch (e) {
    return error(e.message, 502);
  }

  return json({ activity, lead }, 201);
}
