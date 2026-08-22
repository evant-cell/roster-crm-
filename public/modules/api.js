// Fetch wrappers for the Roster API. All requests are JSON. Non-ok responses
// throw an Error carrying the server's error message.
//
// Demo mode: when the URL has ?demo=1 every function below is served from an
// in-memory dataset instead of hitting the network. This never runs unless
// that query flag is present, so it is safe to leave in place.

import { STAGES, isoOffset } from './ui.js';

export const DEMO = new URLSearchParams(location.search).get('demo') === '1';

async function request(path, opts = {}) {
  const headers = {};
  let body = opts.body;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, { ...opts, headers, body });
  } catch (e) {
    throw new Error('Could not reach the server.');
  }
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = null; }
  }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ---------- auth ----------
export async function authStatus() {
  if (DEMO) return { loggedIn: true, email: 'demo@roster.app' };
  return request('/api/auth/status');
}
export const loginUrl = '/api/auth/login';
export async function logout() {
  if (DEMO) return { ok: true };
  return request('/api/auth/logout', { method: 'POST' });
}

// ---------- leads ----------
export async function getLeads(params) {
  if (DEMO) return demo.getLeads(params);
  return request('/api/leads' + qs(params));
}
export async function createLead(data) {
  if (DEMO) return demo.createLead(data);
  return request('/api/leads', { method: 'POST', body: data });
}
export async function getLead(id) {
  if (DEMO) return demo.getLead(id);
  return request(`/api/leads/${id}`);
}
export async function updateLead(id, patch) {
  if (DEMO) return demo.updateLead(id, patch);
  return request(`/api/leads/${id}`, { method: 'PATCH', body: patch });
}
export async function deleteLead(id) {
  if (DEMO) return demo.deleteLead(id);
  return request(`/api/leads/${id}`, { method: 'DELETE' });
}
export async function addActivity(id, activity) {
  if (DEMO) return demo.addActivity(id, activity);
  return request(`/api/leads/${id}/activities`, { method: 'POST', body: activity });
}
export async function snoozeLead(id, days) {
  if (DEMO) return demo.snoozeLead(id, days);
  return request(`/api/leads/${id}/snooze`, { method: 'POST', body: { days } });
}

// ---------- import ----------
export async function previewImport(csv) {
  if (DEMO) return demo.previewImport(csv);
  return request('/api/import/preview', { method: 'POST', body: { csv } });
}
export async function commitImport(csv, mapping, options) {
  if (DEMO) return demo.commitImport(csv, mapping, options);
  return request('/api/import/commit', { method: 'POST', body: { csv, mapping, options } });
}

// ---------- settings ----------
export async function getSettings() {
  if (DEMO) return demo.getSettings();
  return request('/api/settings');
}
export async function updateSettings(patch) {
  if (DEMO) return demo.updateSettings(patch);
  return request('/api/settings', { method: 'PUT', body: patch });
}

// ---------- email ----------
export async function sendEmail(payload) {
  if (DEMO) return demo.sendEmail(payload);
  return request('/api/email/send', { method: 'POST', body: payload });
}

// ================= demo dataset =================
const demo = (() => {
  let nextId = 15;
  let nextActivityId = 1000;
  const activityId = () => nextActivityId++;

  let leads = [
    mk(1, 'Dana Whitfield', 'Whitfield Dental', 'dana@whitfielddental.com', '(512) 555-0142', 'qualified', -2, 0, 'Referral', 4800, ['referral', 'hot'], [1, 1, 1, 0], 'Wants a proposal before Labor Day. Two locations.', [
      ['call', -2, '30 min discovery call. Budget confirmed around $5k. Sending proposal Thursday.'],
      ['stage', -2, 'Moved to Qualified'],
      ['email', -9, 'Intro email sent, replied same day.'],
      ['note', -11, 'Referred by Marco at Cedar Park Chamber.'],
    ]),
    mk(2, 'Marcus Bell', 'Bell & Sons Roofing', 'marcus@bellroofing.co', '(737) 555-0187', 'contacted', -16, -3, 'Website form', 2500, ['website'], [0, 1, 0, 1], 'Slow to reply. Busy season.', [
      ['email', -16, 'Followed up on the quote. No reply yet.'],
      ['call', -24, 'Left voicemail.'],
      ['stage', -24, 'Moved to Contacted'],
    ]),
    mk(3, 'Priya Natarajan', 'Lakeline Pediatrics', 'priya@lakelinepeds.com', '(512) 555-0119', 'contracted', -5, 25, 'Referral', 9600, ['referral'], [1, 1, 1, 1], 'Signed 12-month retainer. Kickoff Sept 8.', [
      ['stage', -5, 'Moved to Contracted'],
      ['email', -5, 'Countersigned agreement received.'],
      ['call', -12, 'Walked through the scope, she wants monthly reporting.'],
    ]),
    mk(4, 'Tom Okafor', 'Okafor Landscaping', 'tom@okaforlandscape.com', '(512) 555-0163', 'new', null, 1, 'Website form', 1800, ['website'], [0, 0, 0, 1], '', [
      ['note', -1, 'Came in through the site form. Asked about a spring campaign.'],
    ]),
    mk(5, 'Elena Vasquez', 'Vasquez Family Law', 'elena@vasquezlaw.com', '(512) 555-0128', 'qualified', -6, 2, 'LinkedIn', 6000, ['linkedin', 'hot'], [1, 1, 0, 1], 'Comparing us with one other agency. Decision by end of month.', [
      ['email', -6, 'Sent case study PDF.'],
      ['call', -8, 'Good call. Wants to see results from a similar firm.'],
      ['stage', -8, 'Moved to Qualified'],
    ]),
    mk(6, 'Greg Halvorsen', 'Halvorsen HVAC', 'greg@halvorsenhvac.com', '(737) 555-0102', 'lost', -30, null, 'Cold outreach', 3200, [], [0, 1, 0, 1], 'Went with his nephew. Revisit in Q1.', [
      ['stage', -30, 'Moved to Lost. Reason: chose another vendor'],
      ['call', -31, 'He is going with a family member. Friendly, keep the door open.'],
    ]),
    mk(7, 'Simone Adair', 'Adair Interiors', 'simone@adairinteriors.com', '(512) 555-0176', 'contacted', -1, 6, 'Instagram', 2200, ['instagram'], [0, 1, 1, 1], 'Wants help with Instagram ads before the fall showroom event.', [
      ['call', -1, 'Quick 15 min intro. Sending pricing sheet.'],
      ['stage', -1, 'Moved to Contacted'],
    ]),
    mk(8, 'Raj Patel', 'North Austin Physical Therapy', 'raj@napt.clinic', '(512) 555-0191', 'qualified', -4, 0, 'Referral', 5400, ['referral'], [1, 1, 1, 0], 'Needs a proposal today. Two other clinics might follow.', [
      ['email', -4, 'He asked for a proposal by the 17th.'],
      ['stage', -4, 'Moved to Qualified'],
      ['call', -7, 'Discovery call.'],
    ]),
    mk(9, 'Kelly Brandt', 'Brandt Bookkeeping', 'kelly@brandtbooks.com', '(737) 555-0154', 'contacted', -21, -7, 'Networking event', 1500, ['event'], [0, 0, 0, 1], '', [
      ['email', -21, 'Sent the follow-up from the Chamber mixer.'],
      ['stage', -21, 'Moved to Contacted'],
    ]),
    mk(10, 'Andre Lucas', 'Lucas Auto Detailing', 'andre@lucasdetail.com', '(512) 555-0137', 'new', null, 1, 'Website form', 1200, ['website'], [0, 0, 0, 1], '', [
      ['note', 0, 'New form submission this morning.'],
    ]),
    mk(11, 'Beth Coleman', 'Coleman Realty Group', 'beth@colemanrealty.com', '(512) 555-0110', 'contracted', -10, 18, 'Referral', 12000, ['referral'], [1, 1, 1, 1], 'Largest account. Quarterly review in September.', [
      ['call', -10, 'Monthly check-in. Happy with lead volume.'],
      ['stage', -60, 'Moved to Contracted'],
    ]),
    mk(12, 'Owen Fitzgerald', 'Fitz Fitness Studio', 'owen@fitzfit.com', '(737) 555-0168', 'lost', -14, null, 'Instagram', 900, ['instagram'], [0, 1, 0, 1], 'No budget right now.', [
      ['stage', -14, 'Moved to Lost. Reason: no budget'],
    ]),
    mk(13, 'Nadia Rahman', 'Rahman Architecture', 'nadia@rahmanarch.com', '(512) 555-0145', 'contacted', -3, 4, 'LinkedIn', 7500, ['linkedin'], [1, 0, 1, 1], 'Interested in a website refresh plus SEO.', [
      ['email', -3, 'She replied with a few questions about timeline.'],
      ['stage', -5, 'Moved to Contacted'],
    ]),
    mk(14, 'Chris Duong', 'Duong Bros Plumbing', 'chris@duongplumbing.com', '(512) 555-0199', 'new', null, 2, 'Cold outreach', 2000, [], [0, 0, 0, 1], '', [
      ['note', -2, 'Added from the trade-show list.'],
    ]),
  ];

  let settings = {
    checklist: ['Has budget', 'Decision maker reached', 'Timeline inside 90 days', 'Fits service area'],
    stale_days: 14,
    digest: { enabled: true, hour: 8 },
  };

  function mk(id, name, company, email, phone, stage, lastN, nextN, source, value, tags, qual, notes, log) {
    return {
      id, name, company, email, phone, stage,
      last_contacted: lastN === null ? null : isoOffset(lastN),
      next_followup: nextN === null ? null : isoOffset(nextN),
      source, est_value: value, tags, notes, qual, custom: {},
      created_at: isoOffset(-40),
      activities: log.map(([type, n, body]) => ({ id: activityId(), type, body, occurred_at: isoOffset(n) })),
    };
  }

  const isOpenD = (l) => l.stage !== 'lost' && l.stage !== 'contracted';
  const dayDiff = (iso) => {
    if (!iso) return null;
    const today = new Date();
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
    const [y, m, d] = iso.split('-').map(Number);
    const x = new Date(y, m - 1, d, 9, 0, 0);
    return Math.round((x - t) / 86400000);
  };

  function counts() {
    const c = { all: leads.length, new: 0, contacted: 0, qualified: 0, contracted: 0, lost: 0, overdue: 0, stale: 0, today: 0 };
    leads.forEach((l) => {
      c[l.stage] = (c[l.stage] || 0) + 1;
      if (isOpenD(l) && l.next_followup && dayDiff(l.next_followup) < 0) c.overdue++;
      if (isOpenD(l) && l.next_followup && dayDiff(l.next_followup) === 0) c.today++;
      if (isOpenD(l) && l.last_contacted && dayDiff(l.last_contacted) <= -settings.stale_days) c.stale++;
    });
    return c;
  }

  function strip(l) {
    const { activities, ...rest } = l;
    return { ...rest };
  }

  function getLeads(params = {}) {
    let arr = leads.slice();
    if (params.stage) arr = arr.filter((l) => l.stage === params.stage);
    if (params.filter === 'overdue') arr = arr.filter((l) => isOpenD(l) && l.next_followup && dayDiff(l.next_followup) < 0);
    else if (params.filter === 'today') arr = arr.filter((l) => isOpenD(l) && l.next_followup && dayDiff(l.next_followup) === 0);
    else if (params.filter === 'stale') arr = arr.filter((l) => isOpenD(l) && l.last_contacted && dayDiff(l.last_contacted) <= -settings.stale_days);
    if (params.q) {
      const q = String(params.q).toLowerCase();
      arr = arr.filter((l) => (l.name + ' ' + l.company + ' ' + l.email + ' ' + l.tags.join(' ')).toLowerCase().includes(q));
    }
    const sortKey = params.sort || 'next_followup';
    const dir = params.dir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === 'stage') { va = STAGES.indexOf(va); vb = STAGES.indexOf(vb); }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
    return { leads: arr.map(strip), counts: counts() };
  }

  function createLead(data) {
    const l = mk(nextId++, data.name || 'New lead', data.company || '', data.email || '', data.phone || '', data.stage || 'new', null, 1, data.source || 'Manual', data.est_value || 0, data.tags || [], data.qual || [0, 0, 0, 0], data.notes || '', [['note', 0, 'Lead created']]);
    leads.unshift(l);
    return Promise.resolve(strip(l));
  }

  function find(id) {
    return leads.find((l) => l.id === +id);
  }

  function getLead(id) {
    const l = find(id);
    if (!l) return Promise.reject(new Error('Lead not found'));
    return Promise.resolve({ lead: strip(l), activities: l.activities.slice() });
  }

  function updateLead(id, patch) {
    const l = find(id);
    if (!l) return Promise.reject(new Error('Lead not found'));
    Object.assign(l, patch);
    if (patch.stage) {
      l.activities.unshift({ id: activityId(), type: 'stage', body: 'Moved to ' + patch.stage[0].toUpperCase() + patch.stage.slice(1), occurred_at: isoOffset(0) });
      if (patch.stage === 'contracted' || patch.stage === 'lost') l.next_followup = null;
    }
    return Promise.resolve(strip(l));
  }

  function deleteLead(id) {
    leads = leads.filter((l) => l.id !== +id);
    return Promise.resolve({ ok: true });
  }

  function addActivity(id, activity) {
    const l = find(id);
    if (!l) return Promise.reject(new Error('Lead not found'));
    const a = { id: activityId(), type: activity.type, body: activity.body, occurred_at: isoOffset(0) };
    l.activities.unshift(a);
    if (activity.touch) l.last_contacted = isoOffset(0);
    return Promise.resolve({ activity: a, lead: strip(l) });
  }

  function snoozeLead(id, days) {
    const l = find(id);
    if (!l) return Promise.reject(new Error('Lead not found'));
    l.next_followup = isoOffset(days);
    return Promise.resolve(strip(l));
  }

  function previewImport(csv) {
    const lines = String(csv || '').split(/\r?\n/).filter((l) => l.trim().length);
    const headers = lines.length ? lines[0].split(',').map((h) => h.trim()) : [];
    const sample = lines.length > 1 ? lines[1].split(',').map((c) => c.trim()) : [];
    const guesses = {};
    const known = { name: 'name', full_name: 'name', email: 'email', company: 'company', business: 'company', phone: 'phone', status: 'stage', stage: 'stage', notes: 'notes', source: 'source', tags: 'tags' };
    headers.forEach((h) => {
      const key = h.toLowerCase().replace(/[^a-z]/g, '_').replace(/^_+|_+$/g, '');
      if (known[key]) guesses[h] = known[key];
    });
    return Promise.resolve({ headers, rowCount: Math.max(0, lines.length - 1), sample, guesses });
  }

  function commitImport(csv, mapping, options) {
    const lines = String(csv || '').split(/\r?\n/).filter((l) => l.trim().length);
    const headers = lines.length ? lines[0].split(',').map((h) => h.trim()) : [];
    const rows = lines.slice(1).map((l) => l.split(','));
    let inserted = 0, updated = 0, skipped = 0, missingEmail = 0;
    rows.forEach((cols) => {
      const rec = {};
      headers.forEach((h, i) => {
        const field = mapping && mapping[h];
        if (!field || field === 'skip') return;
        rec[field] = (cols[i] || '').trim();
      });
      if (!rec.name) { skipped++; return; }
      if (!rec.email) missingEmail++;
      const existing = rec.email ? leads.find((l) => l.email === rec.email) : null;
      if (existing) {
        Object.assign(existing, rec);
        updated++;
      } else {
        const l = mk(nextId++, rec.name, rec.company || '', rec.email || '', rec.phone || '', rec.stage || 'new', null, options && options.defaultFollowupDays ? Number(options.defaultFollowupDays) : 7, rec.source || 'Import', 0, options && options.tag ? [options.tag] : [], [0, 0, 0, 0], rec.notes || '', [['note', 0, 'Imported']]);
        leads.push(l);
        inserted++;
      }
    });
    return Promise.resolve({ inserted, updated, skipped, missingEmail });
  }

  function getSettings() {
    return Promise.resolve(JSON.parse(JSON.stringify(settings)));
  }
  function updateSettings(patch) {
    settings = { ...settings, ...patch };
    return Promise.resolve(JSON.parse(JSON.stringify(settings)));
  }

  function sendEmail(payload) {
    const l = find(payload.lead_id);
    if (l) l.activities.unshift({ id: activityId(), type: 'email', body: payload.subject || '(no subject)', occurred_at: isoOffset(0) });
    return Promise.resolve({ ok: true });
  }

  return { getLeads, createLead, getLead, updateLead, deleteLead, addActivity, snoozeLead, previewImport, commitImport, getSettings, updateSettings, sendEmail };
})();
