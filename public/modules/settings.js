// Settings view: stage names, checklist labels, lead fields (source options and
// custom fields), stale-days threshold, digest, connections, export.

import { $, $$, esc, toast, STAGES, STAGE_LABEL, applyStageLabels, sourceOptions, customFields, FIELD_TYPES } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';

const STAGE_SWATCH = { new: '--slate', contacted: '--blue', qualified: '--green', contracted: '--accent', lost: '--red' };
const STAGE_HINT = { new: 'just added', contacted: 'first touch made', qualified: 'worth pursuing', contracted: 'signed', lost: 'closed out' };

// Unsaved edits to the custom fields list. Rows are re-rendered on add,
// remove, and type change, so the draft holds what is typed until Save.
let fieldDraft = [];
let sourceDraft = null;

export async function renderSettings() {
  if (!state.settings) {
    try {
      state.settings = await api.getSettings();
    } catch (e) {
      toast(e.message);
      state.settings = { checklist: ['Has budget', 'Decision maker reached', 'Timeline inside 90 days', 'Fits service area'], stale_days: 14, digest: { enabled: true, hour: 8 } };
    }
  }
  applyStageLabels(state.settings);
  fieldDraft = cloneFields(customFields(state.settings));
  sourceDraft = null;
  paint();
}

function cloneFields(fields) {
  return fields.map((f) => ({ key: f.key, label: f.label || '', type: f.type || 'text', options: Array.isArray(f.options) ? f.options.slice() : [] }));
}

function splitList(text) {
  return String(text || '').split(',').map((v) => v.trim()).filter(Boolean);
}

// Keys are stored on each lead under lead.custom[key], so they never change
// after creation. Renaming a field only changes its label.
function newFieldKey() {
  return 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fieldRow(f) {
  const typeSelect = `<select data-p="type" aria-label="Field type">${FIELD_TYPES.map((t) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const options = f.type === 'dropdown'
    ? `<input data-p="options" value="${esc(f.options.join(', '))}" placeholder="Options, comma separated" class="opts">`
    : '';
  return `<div class="edit-row field-row" data-key="${esc(f.key)}">
    <input data-p="label" value="${esc(f.label)}" placeholder="Field name" aria-label="Field name">
    ${typeSelect}
    <button class="btn sm ghost danger" data-remove="${esc(f.key)}" aria-label="Remove field">Remove</button>
    ${options}
  </div>`;
}

function readFieldRows() {
  const src = $('#source-options');
  if (src) sourceDraft = src.value;
  fieldDraft = $$('#field-rows .field-row').map((row) => {
    const opts = $('input[data-p="options"]', row);
    return {
      key: row.dataset.key,
      label: $('input[data-p="label"]', row).value.trim(),
      type: $('select[data-p="type"]', row).value,
      options: opts ? splitList(opts.value) : (fieldDraft.find((f) => f.key === row.dataset.key) || { options: [] }).options,
    };
  });
}

function paint() {
  const s = state.settings;
  const grid = $('#settings-grid');
  grid.innerHTML = `
    <div class="set">
      <h3>Stages</h3>
      <p>Every lead sits in exactly one stage. Rename them and the new names show up everywhere.</p>
      <div class="list" id="stage-inputs">
        ${STAGES.map((st) => `<div class="edit-row"><span class="sw" style="background:var(${STAGE_SWATCH[st]})"></span><input value="${esc(STAGE_LABEL[st])}" data-stage="${st}" aria-label="Name for the ${st} stage"><span class="r">${STAGE_HINT[st]}</span></div>`).join('')}
      </div>
      <div><button class="btn sm primary" id="save-stages">Save stages</button></div>
    </div>
    <div class="set">
      <h3>Qualifying checklist</h3>
      <p>The boxes shown on every lead. When all are ticked the lead is flagged qualified.</p>
      <div style="display:flex;flex-direction:column;gap:8px" id="checklist-inputs">
        ${s.checklist.map((label, i) => `<div class="checklist-row"><input value="${esc(label)}" data-i="${i}"></div>`).join('')}
      </div>
      <div><button class="btn sm primary" id="save-checklist">Save checklist</button></div>
    </div>
    <div class="set">
      <h3>Lead fields</h3>
      <p>Add anything the spreadsheet had that isn't a default column. Removing a field hides it, values already saved on leads are kept.</p>
      <div class="field"><label for="source-options">Source options</label><input id="source-options" value="${esc(sourceDraft !== null ? sourceDraft : sourceOptions(s).join(', '))}" placeholder="comma separated"></div>
      <div class="list" id="field-rows">${fieldDraft.map(fieldRow).join('') || '<div class="hint">No custom fields yet.</div>'}</div>
      <div style="display:flex;gap:8px"><button class="btn sm" id="add-field">Add field</button><button class="btn sm primary" id="save-fields">Save fields</button></div>
    </div>
    <div class="set">
      <h3>Send email from Roster</h3>
      <p>Emails go out from your signed-in Google account and get logged on the lead's timeline.</p>
      <div class="connect"><div class="g">G</div><div><div style="font-weight:600">Google Workspace</div><div style="font-size:12px;color:var(--muted)">${esc(state.email || '')}</div></div><span class="st">Connected as ${esc(state.email || '')}</span></div>
      <div class="connect"><div class="g">M</div><div><div style="font-weight:600">Microsoft 365</div><div style="font-size:12px;color:var(--muted)">Outlook and Exchange</div></div><span class="st">Not connected</span><button class="btn sm" id="connect-ms">Connect</button></div>
    </div>
    <div class="set">
      <h3>Reminders</h3>
      <p>A short email each morning listing follow-ups due today and anything overdue.</p>
      <label class="check"><input type="checkbox" id="digest-toggle" ${s.digest.enabled ? 'checked' : ''}> Daily digest at ${formatHour(s.digest.hour)}</label>
      <label class="check">Flag leads with no contact in <select id="stale-days">${[7, 14, 21, 30].map((n) => `<option value="${n}" ${s.stale_days === n ? 'selected' : ''}>${n}</option>`).join('')}</select> days</label>
    </div>
    <div class="set">
      <h3>Your data</h3>
      <p>Export everything to CSV any time. Nothing is locked in.</p>
      <div style="display:flex;gap:8px"><a class="btn sm" href="/api/export" download>Export all leads</a><button class="btn sm" id="export-activity">Export activity log</button></div>
    </div>`;

  $('#save-stages').addEventListener('click', async () => {
    const labels = {};
    $$('#stage-inputs input').forEach((i) => { labels[i.dataset.stage] = i.value.trim(); });
    if (Object.values(labels).some((v) => !v)) { toast('Every stage needs a name'); return; }
    try {
      state.settings = await api.updateSettings({ stage_labels: labels });
      applyStageLabels(state.settings);
      toast('Stages saved');
      paint();
    } catch (e) {
      toast(e.message);
    }
  });

  $('#add-field').addEventListener('click', () => {
    readFieldRows();
    fieldDraft.push({ key: newFieldKey(), label: '', type: 'text', options: [] });
    paint();
    const inputs = $$('#field-rows input[data-p="label"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  $$('#field-rows [data-remove]').forEach((b) => b.addEventListener('click', () => {
    readFieldRows();
    fieldDraft = fieldDraft.filter((f) => f.key !== b.dataset.remove);
    paint();
  }));

  $$('#field-rows select[data-p="type"]').forEach((sel) => sel.addEventListener('change', () => {
    readFieldRows();
    paint();
  }));

  $('#save-fields').addEventListener('click', async () => {
    readFieldRows();
    if (fieldDraft.some((f) => !f.label)) { toast('Every field needs a name'); return; }
    if (fieldDraft.some((f) => f.type === 'dropdown' && f.options.length === 0)) { toast('Dropdown fields need at least one option'); return; }
    const sources = splitList($('#source-options').value);
    try {
      state.settings = await api.updateSettings({ custom_fields: fieldDraft, source_options: sources });
      fieldDraft = cloneFields(customFields(state.settings));
      sourceDraft = null;
      toast('Fields saved');
      paint();
    } catch (e) {
      toast(e.message);
    }
  });

  $('#connect-ms').addEventListener('click', () => toast('Microsoft connect is a v1 feature'));
  $('#export-activity').addEventListener('click', () => toast('Activity log export is a v1 feature'));

  $('#save-checklist').addEventListener('click', async () => {
    const values = $$('#checklist-inputs input').map((i) => i.value.trim()).filter(Boolean);
    if (values.length !== 4) { toast('All four checklist labels are required'); return; }
    try {
      state.settings = await api.updateSettings({ checklist: values });
      toast('Checklist saved');
      paint();
    } catch (e) {
      toast(e.message);
    }
  });

  $('#digest-toggle').addEventListener('change', async (e) => {
    try {
      state.settings = await api.updateSettings({ digest: { ...s.digest, enabled: e.target.checked } });
      toast(e.target.checked ? 'Daily digest turned on' : 'Daily digest turned off');
    } catch (err) {
      toast(err.message);
      e.target.checked = !e.target.checked;
    }
  });

  $('#stale-days').addEventListener('change', async (e) => {
    const n = +e.target.value;
    try {
      state.settings = await api.updateSettings({ stale_days: n });
      toast(`Stale threshold set to ${n} days`);
    } catch (err) {
      toast(err.message);
    }
  });
}

function formatHour(h) {
  const hour = Number(h) || 8;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:00 ${ampm}`;
}
