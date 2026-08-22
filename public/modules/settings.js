// Settings view: checklist labels, stale-days threshold, digest, connections, export.

import { $, $$, esc, toast } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';

export async function renderSettings() {
  if (!state.settings) {
    try {
      state.settings = await api.getSettings();
    } catch (e) {
      toast(e.message);
      state.settings = { checklist: ['Has budget', 'Decision maker reached', 'Timeline inside 90 days', 'Fits service area'], stale_days: 14, digest: { enabled: true, hour: 8 } };
    }
  }
  paint();
}

function paint() {
  const s = state.settings;
  const grid = $('#settings-grid');
  grid.innerHTML = `
    <div class="set">
      <h3>Stages</h3>
      <p>Every lead sits in exactly one stage. Rename or reorder them, they update everywhere.</p>
      <div class="list">
        <div><span class="sw" style="background:var(--slate)"></span>New<span class="r">just added</span></div>
        <div><span class="sw" style="background:var(--blue)"></span>Contacted<span class="r">first touch made</span></div>
        <div><span class="sw" style="background:var(--green)"></span>Qualified<span class="r">worth pursuing</span></div>
        <div><span class="sw" style="background:var(--accent)"></span>Contracted<span class="r">signed</span></div>
        <div><span class="sw" style="background:var(--red)"></span>Lost<span class="r">closed out</span></div>
      </div>
      <div><button class="btn sm" id="edit-stages">Edit stages</button></div>
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
      <h3>Custom fields</h3>
      <p>Add anything the spreadsheet had that isn't a default column.</p>
      <div class="list">
        <div>Source<span class="r">dropdown</span></div><div>Est. value<span class="r">currency</span></div><div>Referred by<span class="r">text</span></div>
      </div>
      <div><button class="btn sm" id="add-field">Add field</button></div>
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

  $('#edit-stages').addEventListener('click', () => toast('Stage editor is a v1 feature'));
  $('#add-field').addEventListener('click', () => toast('Custom fields editor is a v1 feature'));
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
