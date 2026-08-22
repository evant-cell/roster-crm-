import { update } from '../../../lib/db.js';
import { json, error, readJson } from '../../../lib/http.js';
import { todayChicago, addDays } from '../../../lib/dates.js';

export async function onRequestPost({ request, params, env }) {
  const { id } = params;
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  const days = Number.isFinite(body.days) ? body.days : 3;
  const nextFollowup = addDays(todayChicago(), days);

  let updated;
  try {
    const rows = await update(env, 'leads', [`id=eq.${id}`], { next_followup: nextFollowup });
    updated = rows[0];
  } catch (e) {
    return error(e.message, 502);
  }
  if (!updated) return error('Lead not found.', 404);

  return json({ lead: updated });
}
