import { query, update, insert } from '../../lib/db.js';
import { json, error, readJson, isUuid } from '../../lib/http.js';

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
  'source', 'est_value', 'tags', 'notes', 'qual', 'custom', 'is_contact',
];

export async function onRequestGet({ params, env }) {
  const { id } = params;
  if (!isUuid(id)) return error('Lead not found.', 404);
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
  if (!isUuid(id)) return error('Lead not found.', 404);
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  const patch = {};
  for (const key of PATCHABLE_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) return error('No updatable fields provided.');
  if (patch.stage && !STAGES.includes(patch.stage)) return error('Invalid stage.');
  if (patch.is_contact !== undefined) patch.is_contact = Boolean(patch.is_contact);

  let existingRows;
  try {
    existingRows = await query(env, 'leads', { select: 'id,stage,is_contact', filters: [`id=eq.${id}`], limit: 1 });
  } catch (e) {
    return error(e.message, 502);
  }
  const existing = existingRows && existingRows[0];
  if (!existing) return error('Lead not found.', 404);

  const stageChanged = patch.stage && patch.stage !== existing.stage;
  const kindChanged = patch.is_contact !== undefined && patch.is_contact !== Boolean(existing.is_contact);
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

  if (kindChanged) {
    try {
      await insert(env, 'activities', [{
        lead_id: id,
        type: 'stage',
        body: patch.is_contact ? 'Moved to Contacts' : 'Made a lead',
      }], { returning: false });
    } catch {
      // Update already succeeded, activity logging is best-effort.
    }
  }

  if (stageChanged && !kindChanged) {
    try {
      // Stage names can be renamed in Settings (settings.stage_labels).
      let label = STAGE_LABELS[patch.stage] || patch.stage;
      const labelRows = await query(env, 'settings', { select: 'value', filters: ['key=eq.stage_labels'], limit: 1 });
      const custom = labelRows && labelRows[0] && labelRows[0].value;
      if (custom && custom[patch.stage]) label = custom[patch.stage];
      await insert(env, 'activities', [{
        lead_id: id,
        type: 'stage',
        body: `Moved to ${label}`,
      }], { returning: false });
    } catch {
      // Update already succeeded, activity logging is best-effort.
    }
  }

  return json({ lead: updated });
}

export async function onRequestDelete({ params, env }) {
  const { id } = params;
  if (!isUuid(id)) return error('Lead not found.', 404);
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
