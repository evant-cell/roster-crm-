import { query, insert } from '../../lib/db.js';
import { json, error, readJson } from '../../lib/http.js';
import { todayChicago, daysBetween } from '../../lib/dates.js';

const STAGES = ['new', 'contacted', 'qualified', 'contracted', 'lost'];
const SORT_COLUMNS = new Set(['name', 'company', 'stage', 'last_contacted', 'next_followup', 'created_at']);

const INSERTABLE_FIELDS = [
  'name', 'company', 'email', 'phone', 'stage', 'last_contacted', 'next_followup',
  'source', 'est_value', 'tags', 'notes', 'qual', 'custom',
];

function pickInsertable(body) {
  const row = {};
  for (const key of INSERTABLE_FIELDS) {
    if (body[key] !== undefined) row[key] = body[key];
  }
  return row;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const stageParam = url.searchParams.get('stage');
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const filter = url.searchParams.get('filter');
  const sort = url.searchParams.get('sort') || 'created_at';
  const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  let staleDays = 14;
  try {
    const rows = await query(env, 'settings', { filters: ['key=eq.stale_days'], limit: 1 });
    if (rows && rows[0]) staleDays = Number(rows[0].value) || 14;
  } catch {
    // fall back to default
  }

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

  const today = todayChicago();

  function isOverdue(lead) {
    return Boolean(lead.next_followup) && lead.next_followup < today
      && lead.stage !== 'contracted' && lead.stage !== 'lost';
  }
  function isToday(lead) {
    return lead.next_followup === today
      && lead.stage !== 'contracted' && lead.stage !== 'lost';
  }
  function isStale(lead) {
    if (lead.stage === 'contracted' || lead.stage === 'lost') return false;
    if (!lead.last_contacted) return daysBetween(lead.created_at.slice(0, 10), today) >= staleDays;
    return daysBetween(lead.last_contacted, today) >= staleDays;
  }

  const counts = { all: leads.length, new: 0, contacted: 0, qualified: 0, contracted: 0, lost: 0, overdue: 0, stale: 0, today: 0 };
  for (const lead of leads) {
    if (STAGES.includes(lead.stage)) counts[lead.stage] += 1;
    if (isOverdue(lead)) counts.overdue += 1;
    if (isToday(lead)) counts.today += 1;
    if (isStale(lead)) counts.stale += 1;
  }

  let filtered = leads;
  if (stageParam && STAGES.includes(stageParam)) {
    filtered = filtered.filter((l) => l.stage === stageParam);
  }
  if (q) {
    filtered = filtered.filter((l) => (
      (l.name || '').toLowerCase().includes(q)
      || (l.company || '').toLowerCase().includes(q)
      || (l.email || '').toLowerCase().includes(q)
    ));
  }
  if (filter === 'overdue') filtered = filtered.filter(isOverdue);
  else if (filter === 'today') filtered = filtered.filter(isToday);
  else if (filter === 'stale') filtered = filtered.filter(isStale);

  const sortKey = SORT_COLUMNS.has(sort) ? sort : 'created_at';
  filtered = filtered.slice().sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  return json({ leads: filtered, counts });
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  const row = pickInsertable(body);
  if (row.stage && !STAGES.includes(row.stage)) return error('Invalid stage.');

  let created;
  try {
    const rows = await insert(env, 'leads', [row]);
    created = rows[0];
  } catch (e) {
    return error(e.message, 502);
  }

  try {
    await insert(env, 'activities', [{ lead_id: created.id, type: 'note', body: 'Lead created' }], { returning: false });
  } catch {
    // Lead creation already succeeded, activity logging is best-effort.
  }

  return json({ lead: created }, 201);
}
