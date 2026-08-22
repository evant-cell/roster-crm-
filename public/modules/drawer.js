// Lead detail drawer: fields, stage control, qualifying checklist, activity
// timeline, note compose, email compose, and quick actions.

import { $, $$, esc, fmt, initials, toast, STAGES, STAGE_LABEL } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';
import { refreshCurrentView } from '../app.js';

const SOURCES = ['Referral', 'Website form', 'LinkedIn', 'Instagram', 'Networking event', 'Cold outreach', 'Manual', 'Import'];
const DEFAULT_CHECKLIST = ['Has budget', 'Decision maker reached', 'Timeline inside 90 days', 'Fits service area'];

let current = null; // { lead, activities }
let fieldTimer = null;
let pendingPatch = {};
let emailOpen = false;

function checklist() {
  return (state.settings && state.settings.checklist && state.settings.checklist.length === 4) ? state.settings.checklist : DEFAULT_CHECKLIST;
}

export async function openLead(id, opts = {}) {
  state.selected = id;
  try {
    current = await api.getLead(id);
  } catch (e) {
    toast(e.message);
    return;
  }
  emailOpen = opts.keepEmailOpen ? emailOpen : false;
  paint();
  const dr = $('#drawer');
  dr.classList.add('open');
  $('#scrim').classList.add('open');
  dr.setAttribute('aria-hidden', 'false');
  if (opts.focusName) {
    setTimeout(() => { const i = $('#f-name'); if (i) { i.focus(); i.select(); } }, 250);
  }
}

export function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#scrim').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  state.selected = null;
  current = null;
  emailOpen = false;
}

function paint() {
  if (!current) return;
  const { lead: l, activities } = current;
  const qual = l.qual || [0, 0, 0, 0];
  const score = qual.filter(Boolean).length;
  const labels = checklist();
  const dr = $('#drawer');

  dr.innerHTML = `
    <div class="d-h"><div class="avatar" style="width:38px;height:38px;font-size:13px">${initials(l.name)}</div>
      <div><h2>${esc(l.name)}</h2><div class="co">${l.company ? esc(l.company) : 'No company yet'} &middot; ${esc(l.source || '')}</div></div>
      <button class="x" id="d-close" aria-label="Close">&#x2715;</button></div>
    <div class="d-b">
      <div class="seg" id="seg">${STAGES.map((s) => `<button class="${s} ${l.stage === s ? 'on' : ''}" data-s="${s}">${STAGE_LABEL[s]}</button>`).join('')}</div>
      <div class="quick">
        <button class="btn sm" data-q="call">Log call</button>
        <button class="btn sm" data-q="email">Send email</button>
        <button class="btn sm" data-q="snooze">Snooze 3d</button>
        <button class="btn sm ghost" data-q="copy">Copy email</button>
      </div>
      <div class="mailbox ${emailOpen ? '' : 'hidden'}" id="mailbox">
        <div class="field"><label>To</label><input id="m-to" value="${esc(l.email)}"></div>
        <div class="field"><label>Subject</label><input id="m-subject" placeholder="Subject"></div>
        <div class="field"><label>Body</label><textarea id="m-body" placeholder="Write your message"></textarea></div>
        <div class="row"><button class="btn sm ghost" id="m-cancel">Cancel</button><button class="btn sm primary" id="m-send">Send</button></div>
      </div>
      <div class="fields">
        <div class="field"><label>Name</label><input id="f-name" value="${esc(l.name)}" data-k="name"></div>
        <div class="field"><label>Company</label><input value="${esc(l.company)}" data-k="company"></div>
        <div class="field"><label>Email</label><input value="${esc(l.email)}" data-k="email"></div>
        <div class="field"><label>Phone</label><input value="${esc(l.phone)}" data-k="phone" class="mono"></div>
        <div class="field"><label>Last contacted</label><input type="date" value="${l.last_contacted || ''}" data-k="last_contacted"></div>
        <div class="field"><label>Next follow-up</label><input type="date" value="${l.next_followup || ''}" data-k="next_followup"></div>
        <div class="field"><label>Source</label><select data-k="source">${SOURCES.map((s) => `<option ${l.source === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Est. value</label><input type="number" value="${l.est_value || 0}" data-k="est_value" class="mono"></div>
        <div class="field wide"><label>Tags</label><input value="${esc((l.tags || []).join(', '))}" data-k="tags" placeholder="comma separated"></div>
        <div class="field wide"><label>Notes</label><textarea data-k="notes" placeholder="Anything worth remembering">${esc(l.notes)}</textarea></div>
      </div>
      <div class="d-sec"><h3>Qualifying checklist <span class="line"></span></h3>
        <div class="qual" id="qual">${labels.map((q, i) => `<label><input type="checkbox" data-i="${i}" ${qual[i] ? 'checked' : ''}> ${esc(q)}</label>`).join('')}</div>
        <div class="score"><span id="score-txt">${score} of ${labels.length}</span><div class="bar"><i id="score-bar" style="width:${(score / labels.length) * 100}%"></i></div><span>${score === labels.length ? 'Ready to qualify' : score >= 2 ? 'Getting there' : 'Early'}</span></div>
      </div>
      <div class="d-sec"><h3>Activity <span class="line"></span></h3>
        <div class="compose"><textarea id="note-txt" placeholder="Add a note, log a call, or paste an email"></textarea>
          <div class="row"><select id="note-type"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option></select><label class="check" style="font-size:12.5px;color:var(--muted)"><input type="checkbox" id="note-touch" checked> Counts as contact</label><span style="flex:1"></span><button class="btn sm primary" id="note-add">Add</button></div></div>
        <div class="timeline">${activities.map((e) => `<div class="ev ${e.type}"><div class="dot"><i></i></div><div class="body"><div class="when">${fmt(e.occurred_at)} &middot; ${esc(e.type)}</div><div class="txt">${esc(e.body)}</div></div></div>`).join('') || '<div class="hint">No activity yet.</div>'}</div>
      </div>
    </div>
    <div class="d-f"><span class="hint">Changes save as you type</span><span class="spacer"></span><button class="btn sm ghost danger" id="d-del">Archive</button><button class="btn sm" id="d-done">Done</button></div>`;

  wire(l);
}

function wire(l) {
  const dr = $('#drawer');
  $('#d-close', dr).onclick = closeDrawer;
  $('#d-done', dr).onclick = closeDrawer;

  $('#d-del', dr).onclick = async () => {
    if (!confirm(`Archive ${l.name}?`)) return;
    try {
      await api.deleteLead(l.id);
      closeDrawer();
      toast(`${l.name} archived.`);
      refreshCurrentView();
    } catch (e) {
      toast(e.message);
    }
  };

  $$('#seg button', dr).forEach((b) => b.onclick = async () => {
    if (l.stage === b.dataset.s) return;
    try {
      await api.updateLead(l.id, { stage: b.dataset.s });
      toast(`${l.name} moved to ${STAGE_LABEL[b.dataset.s]}`);
      await openLead(l.id);
      refreshCurrentView();
    } catch (e) {
      toast(e.message);
    }
  });

  $$('[data-k]', dr).forEach((input) => input.addEventListener('input', () => {
    const k = input.dataset.k;
    let v = input.value;
    if (k === 'tags') v = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === 'est_value') v = +v || 0;
    else if ((k === 'last_contacted' || k === 'next_followup') && !v) v = null;
    pendingPatch[k] = v;
    if (k === 'name') $('.d-h h2', dr).textContent = v || 'Unnamed';
    if (k === 'company') $('.d-h .co', dr).innerHTML = `${v ? esc(v) : 'No company yet'} &middot; ${esc(l.source || '')}`;
    clearTimeout(fieldTimer);
    fieldTimer = setTimeout(flushFields, 400);
  }));

  $$('#qual input', dr).forEach((c) => c.addEventListener('change', async () => {
    const qual = (l.qual || [0, 0, 0, 0]).slice();
    qual[+c.dataset.i] = c.checked;
    const labels = checklist();
    const s = qual.filter(Boolean).length;
    $('#score-txt', dr).textContent = `${s} of ${labels.length}`;
    $('#score-bar', dr).style.width = (s / labels.length) * 100 + '%';
    try {
      const updated = await api.updateLead(l.id, { qual });
      current.lead = updated;
      if (s === labels.length && (l.stage === 'new' || l.stage === 'contacted')) toast('All four ticked. Move to Qualified?');
    } catch (e) {
      toast(e.message);
    }
  }));

  $('#note-add', dr).onclick = async () => {
    const t = $('#note-txt', dr).value.trim();
    if (!t) { toast('Type something first'); return; }
    const type = $('#note-type', dr).value;
    const touch = $('#note-touch', dr).checked;
    try {
      await api.addActivity(l.id, { type, body: t, touch });
      await openLead(l.id);
      refreshCurrentView();
      toast('Added to timeline');
    } catch (e) {
      toast(e.message);
    }
  };

  $$('[data-q]', dr).forEach((b) => b.onclick = async () => {
    const q = b.dataset.q;
    try {
      if (q === 'call') {
        await api.addActivity(l.id, { type: 'call', body: 'Call logged', touch: true });
        await openLead(l.id);
        refreshCurrentView();
        toast('Call logged, last contacted set to today');
      } else if (q === 'email') {
        emailOpen = !emailOpen;
        $('#mailbox', dr).classList.toggle('hidden', !emailOpen);
      } else if (q === 'snooze') {
        const updated = await api.snoozeLead(l.id, 3);
        await openLead(l.id);
        refreshCurrentView();
        toast(`Follow-up moved to ${fmt(updated.next_followup)}`);
      } else if (q === 'copy') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(l.email).catch(() => {});
        }
        toast(`Copied ${l.email}`);
      }
    } catch (e) {
      toast(e.message);
    }
  });

  const cancelBtn = $('#m-cancel', dr);
  if (cancelBtn) cancelBtn.onclick = () => { emailOpen = false; $('#mailbox', dr).classList.add('hidden'); };
  const sendBtn = $('#m-send', dr);
  if (sendBtn) sendBtn.onclick = async () => {
    const to = $('#m-to', dr).value.trim();
    const subject = $('#m-subject', dr).value.trim();
    const body = $('#m-body', dr).value.trim();
    if (!to || !body) { toast('Add a recipient and a message'); return; }
    sendBtn.disabled = true;
    try {
      await api.sendEmail({ lead_id: l.id, to, subject, body });
      toast('Sent');
      await openLead(l.id);
      refreshCurrentView();
    } catch (e) {
      toast(e.message);
    } finally {
      sendBtn.disabled = false;
    }
  };
}

async function flushFields() {
  if (!current || Object.keys(pendingPatch).length === 0) return;
  const patch = pendingPatch;
  pendingPatch = {};
  try {
    const updated = await api.updateLead(current.lead.id, patch);
    current.lead = updated;
    refreshCurrentView();
  } catch (e) {
    toast(e.message);
  }
}
