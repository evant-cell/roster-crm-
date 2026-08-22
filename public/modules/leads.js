// Leads view: stat tiles, filter chips, search/sort backed table.

import { $, $$, esc, money, fmt, rel, dueClass, dueText, isOpen, toast, STAGE_LABEL, STAGES, updateNavCounts } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';
import { openLead } from './drawer.js';

function queryParams() {
  const params = { q: state.query || undefined, sort: state.sortKey, dir: state.sortDir > 0 ? 'asc' : 'desc' };
  if (state.filter === 'overdue' || state.filter === 'stale') params.filter = state.filter;
  else if (state.filter !== 'all') params.stage = state.filter;
  return params;
}

export async function renderLeads() {
  let data;
  try {
    data = await api.getLeads(queryParams());
  } catch (e) {
    toast(e.message);
    data = { leads: [], counts: state.counts };
  }
  state.leads = data.leads;
  state.counts = data.counts;
  updateNavCounts(state.counts);

  const c = state.counts;
  const won = state.leads.filter((l) => l.stage === 'contracted');
  const qualifiedValue = state.leads.filter((l) => l.stage === 'qualified').reduce((s, l) => s + (l.est_value || 0), 0);
  const openCount = (c.all || 0) - (c.contracted || 0) - (c.lost || 0);
  $('#stats').innerHTML = `
    <div class="stat"><span class="lbl">Open leads</span><span class="val">${openCount}</span><span class="delta">${c.new || 0} new</span></div>
    <div class="stat"><span class="lbl">Qualified pipeline</span><span class="val">${money(qualifiedValue)}</span><span class="delta">${c.qualified || 0} leads</span></div>
    <div class="stat"><span class="lbl">Contracted</span><span class="val">${c.contracted || 0}</span><span class="delta">${money(won.reduce((s, l) => s + (l.est_value || 0), 0))} signed</span></div>
    <div class="stat ${c.overdue ? 'alert' : ''}"><button data-filter="overdue"><span class="lbl">Overdue follow-ups</span><span class="val" style="display:block">${c.overdue || 0}</span><span class="delta">${c.today || 0} due today</span></button></div>`;
  $$('#stats [data-filter]').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.filter; renderLeads(); }));

  const chips = [
    ['all', 'All', c.all || 0],
    ...STAGES.map((s) => [s, STAGE_LABEL[s], c[s] || 0]),
    ['overdue', 'Overdue', c.overdue || 0],
    ['stale', 'No contact 14d+', c.stale || 0],
  ];
  $('#chips').innerHTML = chips.map(([k, l, n]) => `<button class="chip ${state.filter === k ? 'on' : ''}" data-f="${k}">${l}<span class="n">${n}</span></button>`).join('');
  $$('#chips .chip').forEach((chip) => chip.addEventListener('click', () => { state.filter = chip.dataset.f; renderLeads(); }));

  $('#rowcount').textContent = `${state.leads.length} of ${c.all || 0}`;
  $$('thead th button[data-sort]').forEach((b) => {
    b.classList.toggle('sorted', b.dataset.sort === state.sortKey);
    b.textContent = b.textContent.replace(/[ ↑↓]+$/, '') + (b.dataset.sort === state.sortKey ? (state.sortDir > 0 ? ' ↑' : ' ↓') : '');
  });

  $('#rows').innerHTML = state.leads.length
    ? state.leads.map((l) => `<tr data-id="${l.id}" class="${state.selected === l.id ? 'sel' : ''}">
        <td><div class="name">${esc(l.name)}</div></td>
        <td>${l.company ? esc(l.company) : '<span class="co">no company</span>'}</td>
        <td><div style="font-size:12.5px">${esc(l.email)}</div><div class="co mono">${esc(l.phone)}</div></td>
        <td><span class="stage ${l.stage}">${STAGE_LABEL[l.stage]}</span></td>
        <td class="due">${l.last_contacted ? fmt(l.last_contacted) + ' <span style="opacity:.6">' + rel(l.last_contacted) + '</span>' : '<span style="color:var(--muted)">never</span>'}</td>
        <td class="due ${isOpen(l) ? dueClass(l.next_followup) : 'none'}">${isOpen(l) ? dueText(l.next_followup) : 'closed'}</td>
        <td>${(l.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="empty">Nothing matches. Clear the filter or search.</td></tr>`;
  $$('#rows tr[data-id]').forEach((row) => row.addEventListener('click', () => openLead(row.dataset.id)));
}
