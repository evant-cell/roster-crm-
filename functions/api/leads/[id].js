import { query, update, insert } from '../../lib/db.js';
import { json, error, readJson } from '../../lib/http.js';

const STAGES = ['new', 'contacted', 'qualified', 'contracted', 'lost'];
const STAGE_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  contracted: 'Contracted',
  lost: 'Lost',
};

const PATCHABLE_FIELDS = [
  'name', 'company', 'email', 'phone', 'stage', 'last_contacted', 'next_followup',
  'source', 'est_value', 'tags', 'notes', 'qual', 'custom',
];

export async function onRequestGet({ params, env }) {
  const { id } = params;
  let leads;
  try {
    leads = await query(env, 'leads', { select: '*', filters: [`id=eq.${id}`], limit: 1 });
  } catch (e) {
    return error(e.message, 502);
  }
  const lead = leads && leads[0];
  if (!lead) return error('Lead not found.', 404);

  let activities;
  try {
    activities = await query(env, 'activities', {
      select: '*',
      filters: [`lead_id=eq.${id}`],
      order: 'occurred_at.desc',
    });
  } catch (e) {
    return error(e.message, 502);
  }

  return json({ lead, activities });
}

export async function onRequestPatch({ request, params, env }) {
  const { id } = params;
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  const patch = {};
  for (const key of PATCHABLE_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) return error('No updatable fields provided.');
  if (patch.stage && !STAGES.includes(patch.stage)) return error('Invalid stage.');

  let existingRows;
  try {
    existingRows = await query(env, 'leads', { select: 'id,stage', filters: [`id=eq.${id}`], limit: 1 });
  } catch (e) {
    return error(e.message, 502);
  }
  const existing = existingRows && existingRows[0];
  if (!existing) return error('Lead not found.', 404);

  const stageChanged = patch.stage && patch.stage !== existing.stage;
  if (stageChanged && (patch.stage === 'contracted' || patch.stage === 'lost')) {
    patch.next_followup = null;
  }

  let updated;
  try {
    const rows = await update(env, 'leads', [`id=eq.${id}`], patch);
    updated = rows[0];
  } catch (e) {
    return error(e.message, 502);
  }

  if (stageChanged) {
    try {
      await insert(env, 'activities', [{
        lead_id: id,
        type: 'stage',
        body: `Moved to ${STAGE_LABELS[patch.stage] || patch.stage}`,
      }], { returning: false });
    } catch {
      // Update already succeeded, activity logging is best-effort.
    }
  }

  return json({ lead: updated });
}

export async function onRequestDelete({ params, env }) {
  const { id } = params;
  let updated;
  try {
    const rows = await update(env, 'leads', [`id=eq.${id}`], { archived_at: new Date().toISOString() });
    updated = rows[0];
  } catch (e) {
    return error(e.message, 502);
  }
  if (!updated) return error('Lead not found.', 404);
  return json({ ok: true });
}
