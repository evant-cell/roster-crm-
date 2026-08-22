import { parseCsv } from '../../lib/csv.js';
import { normalizeStage } from '../../lib/leads-map.js';
import { query, insert, update } from '../../lib/db.js';
import { json, error, readJson } from '../../lib/http.js';
import { todayChicago, addDays, parseLooseDate } from '../../lib/dates.js';

function parseValue(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseTags(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,|;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function rowToFields(headers, row, mapping) {
  const fields = {};
  headers.forEach((header, i) => {
    const target = mapping[header];
    if (!target || target === 'skip') return;
    const raw = row[i] !== undefined ? String(row[i]).trim() : '';
    fields[target] = raw;
  });
  return fields;
}

function isEmptyFields(fields) {
  return Object.values(fields).every((v) => !v);
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  const csv = body.csv;
  const mapping = body.mapping || {};
  const options = body.options || {};
  if (typeof csv !== 'string' || !csv.trim()) return error('csv is required.');

  const { headers, rows } = parseCsv(csv);
  if (headers.length === 0) return error('Could not find a header row in that CSV.');

  const defaultFollowupDays = options.defaultFollowupDays === null || options.defaultFollowupDays === undefined
    ? null
    : Number(options.defaultFollowupDays);
  const extraTag = options.tag ? String(options.tag).trim() : null;
  const today = todayChicago();

  let skipped = 0;
  let missingEmail = 0;

  // Build one merged record per row, and dedupe rows that share an email
  // within the file itself (last occurrence wins per field).
  const byEmail = new Map();
  const noEmailRows = [];

  for (const row of rows) {
    const fields = rowToFields(headers, row, mapping);
    if (isEmptyFields(fields)) {
      skipped += 1;
      continue;
    }
    const email = (fields.email || '').trim().toLowerCase();
    if (!email) {
      missingEmail += 1;
      noEmailRows.push(fields);
      continue;
    }
    const existing = byEmail.get(email) || {};
    // Later rows win, but only where they actually carry a value. A blank
    // cell further down the file must not wipe what an earlier row set.
    const merged = { ...existing };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== '') merged[key] = value;
    }
    byEmail.set(email, { ...merged, email });
  }

  function buildNewLeadRow(fields) {
    const tags = parseTags(fields.tags);
    if (extraTag && !tags.includes(extraTag)) tags.push(extraTag);
    let nextFollowup = parseLooseDate(fields.next_followup) || null;
    if (!nextFollowup && defaultFollowupDays !== null && Number.isFinite(defaultFollowupDays)) {
      nextFollowup = addDays(today, defaultFollowupDays);
    }
    return {
      name: fields.name || '',
      company: fields.company || '',
      email: fields.email || '',
      phone: fields.phone || '',
      stage: normalizeStage(fields.stage),
      last_contacted: parseLooseDate(fields.last_contacted),
      next_followup: nextFollowup,
      source: fields.source || '',
      est_value: parseValue(fields.est_value),
      tags,
      notes: fields.notes || '',
    };
  }

  // Look up existing (non-archived) leads by email to decide insert vs update.
  let existingLeads = [];
  try {
    existingLeads = await query(env, 'leads', {
      select: 'id,email,name,company,phone,tags',
      filters: ["archived_at=is.null", "email=neq."],
    });
  } catch (e) {
    return error(e.message, 502);
  }
  const existingByEmail = new Map();
  for (const lead of existingLeads) {
    if (!lead.email) continue;
    existingByEmail.set(lead.email.toLowerCase(), lead);
  }

  const toInsert = [];
  const toUpdate = []; // { id, patch }

  for (const [email, fields] of byEmail.entries()) {
    const match = existingByEmail.get(email);
    if (match) {
      const patch = {};
      if (fields.name) patch.name = fields.name;
      if (fields.company) patch.company = fields.company;
      if (fields.phone) patch.phone = fields.phone;
      const tags = Array.isArray(match.tags) ? match.tags.slice() : [];
      const incomingTags = parseTags(fields.tags);
      for (const t of incomingTags) if (!tags.includes(t)) tags.push(t);
      if (extraTag && !tags.includes(extraTag)) tags.push(extraTag);
      if (tags.length !== (match.tags || []).length) patch.tags = tags;
      toUpdate.push({ id: match.id, patch });
    } else {
      toInsert.push(buildNewLeadRow(fields));
    }
  }
  for (const fields of noEmailRows) {
    toInsert.push(buildNewLeadRow(fields));
  }

  let insertedRows = [];
  try {
    if (toInsert.length > 0) {
      insertedRows = await insert(env, 'leads', toInsert);
    }
  } catch (e) {
    return error(e.message, 502);
  }

  const updatedRows = [];
  try {
    for (const { id, patch } of toUpdate) {
      if (Object.keys(patch).length === 0) {
        updatedRows.push({ id });
        continue;
      }
      const rows2 = await update(env, 'leads', [`id=eq.${id}`], patch);
      updatedRows.push(rows2[0] || { id });
    }
  } catch (e) {
    return error(e.message, 502);
  }

  // One 'import' activity per lead touched, best-effort.
  try {
    const activityRows = [
      ...insertedRows.map((l) => ({ lead_id: l.id, type: 'import', body: 'Imported from CSV' })),
      ...updatedRows.map((l) => ({ lead_id: l.id, type: 'import', body: 'Updated from CSV import' })),
    ];
    if (activityRows.length > 0) {
      await insert(env, 'activities', activityRows, { returning: false });
    }
  } catch {
    // Import already succeeded, activity logging is best-effort.
  }

  return json({
    inserted: insertedRows.length,
    updated: updatedRows.length,
    skipped,
    missingEmail,
  });
}
