import { update } from '../../../lib/db.js';
import { json, error, readJson, isUuid } from '../../../lib/http.js';
import { todayChicago, addDays } from '../../../lib/dates.js';

export async function onRequestPost({ request, params, env }) {
  const { id } = params;
  if (!isUuid(id)) return error('Lead not found.', 404);
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  // Clamp to a whole number of days inside a sane window, otherwise addDays
  // can build an out-of-range Date and throw.
  const requested = Number.isFinite(body.days) ? Math.trunc(body.days) : 3;
  const days = Math.min(3650, Math.max(-3650, requested));
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
