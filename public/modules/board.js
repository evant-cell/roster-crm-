// Kanban board view, grouped by stage.

import { $, $$, esc, money, rel, dueClass, isOpen, toast, STAGE_LABEL, STAGES } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';
import { openLead } from './drawer.js';

export async function renderBoard() {
  let all;
  try {
    all = await api.getLeads({ q: state.query || undefined, sort: 'name', dir: 'asc' });
  } catch (e) {
    toast(e.message);
    all = { leads: [], counts: state.counts };
  }
  state.counts = all.counts;

  $('#board').innerHTML = STAGES.map((s) => {
    const arr = all.leads.filter((l) => l.stage === s);
    const total = arr.reduce((a, l) => a + (l.est_value || 0), 0);
    return `<div class="col"><div class="col-h"><span class="stage ${s}">${STAGE_LABEL[s]}</span><span class="n">${arr.length} · ${money(total)}</span></div><div class="col-b">${
      arr.map((l) => `
      <div class="card" data-id="${l.id}" tabindex="0"><div class="name">${esc(l.name)}</div><div class="co">${esc(l.company)}</div>
      <div class="meta"><span class="val">${money(l.est_value)}</span><span class="due ${isOpen(l) ? dueClass(l.next_followup) : 'none'}">${isOpen(l) ? (l.next_followup ? rel(l.next_followup) : 'no date') : ''}</span></div></div>`).join('') || '<div class="empty" style="padding:24px 8px;font-size:12.5px">Empty</div>'
    }</div></div>`;
  }).join('');
  $$('#board .card').forEach((c) => {
    c.addEventListener('click', () => openLead(+c.dataset.id));
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') openLead(+c.dataset.id); });
  });
}
