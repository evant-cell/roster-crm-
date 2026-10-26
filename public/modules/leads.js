// Leads view: stat tiles, filter chips, search/sort backed table.

import { $, $$, esc, money, fmt, rel, dueClass, dueText, isOpen, toast, STAGE_LABEL, STAGES, updateNavCounts, customFields, customSortKey, markSorted } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';
import { openLead } from './drawer.js';

function queryParams() {
  const params = { q: state.query || undefined, sort: state.sortKey, dir: state.sortDir > 0 ? 'asc' : 'desc' };
  if (state.filter === 'overdue' || state.filter === 'stale') params.filter = state.filter;
  else if (state.filter !== 'all') params.stage = state.filter;
  return params;
}

// Custom fields marked "Show as a column" in Settings get their own column.
// list_pos picks where it goes: 'start' (before Name, the default) or 'end'
// (after Tags, just before Notes).
export function listFields(pos) {
  return customFields(state.settings).filter((f) => f.in_list && (f.list_pos === 'end' ? 'end' : 'start') === pos);
}

export function customCell(f, lead) {
  const v = (lead.custom || {})[f.key];
  if (v === null || v === undefined || v === '') return '';
  if (f.type === 'currency') return money(v);
  if (f.type === 'date') return fmt(v);
  if (f.type === 'dropdown') return `<span class="tag">${esc(v)}</span>`;
  return esc(v);
}

function customHeader(f) {
  const th = document.createElement('th');
  th.className = 'cf';
  const btn = document.createElement('button');
  btn.dataset.sort = customSortKey(f);
  btn.textContent = f.label;
  th.appendChild(btn);
  return th;
}

function paintCustomHeaders(startFields, endFields) {
  const row = $('#leads-head');
  $$('th.cf', row).forEach((th) => th.remove());
  const nameHeader = row.firstElementChild;
  const notesHeader = row.lastElementChild;
  startFields.forEach((f) => row.insertBefore(customHeader(f), nameHeader));
  endFields.forEach((f) => row.insertBefore(customHeader(f), notesHeader));
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
  updateNavCounts(state.counts, data.totals);

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

  const shown = state.leads;
  $('#rowcount').textContent = `${shown.length} of ${c.all || 0}`;
  const startFields = listFields('start');
  const endFields = listFields('end');
  paintCustomHeaders(startFields, endFields);

  // Header clicks sort by that column. Clicking the sorted column flips it.
  const sortButtons = $$('#leads-head button[data-sort]');
  markSorted(sortButtons, 'sort', state.sortKey, state.sortDir);
  sortButtons.forEach((b) => {
    b.onclick = () => {
      if (state.sortKey === b.dataset.sort) state.sortDir *= -1;
      else { state.sortKey = b.dataset.sort; state.sortDir = 1; }
      renderLeads();
    };
  });

  $('#rows').innerHTML = shown.length
    ? shown.map((l) => `<tr data-id="${l.id}" class="${state.selected === l.id ? 'sel' : ''}">
        ${startFields.map((f) => `<td class="cf">${customCell(f, l)}</td>`).join('')}
        <td><div class="name">${esc(l.name)}</div></td>
        <td>${l.company ? esc(l.company) : '<span class="co">no company</span>'}</td>
        <td><div style="font-size:12.5px">${esc(l.email)}</div><div class="co mono">${esc(l.phone)}</div></td>
        <td><span class="stage ${l.stage}">${STAGE_LABEL[l.stage]}</span></td>
        <td class="due">${l.last_contacted ? fmt(l.last_contacted) + ' <span style="opacity:.6">' + rel(l.last_contacted) + '</span>' : '<span style="color:var(--muted)">never</span>'}</td>
        <td class="due ${isOpen(l) ? dueClass(l.next_followup) : 'none'}">${isOpen(l) ? dueText(l.next_followup) : 'closed'}</td>
        <td>${(l.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</td>
        ${endFields.map((f) => `<td class="cf">${customCell(f, l)}</td>`).join('')}
        <td class="notes" title="${esc(l.notes)}"><div>${esc(l.notes).replace(/\n+/g, ' &middot; ')}</div></td>
      </tr>`).join('')
    : `<tr><td colspan="${8 + startFields.length + endFields.length}" class="empty">Nothing matches. Clear the filter or search.</td></tr>`;
  $$('#rows tr[data-id]').forEach((row) => row.addEventListener('click', () => openLead(row.dataset.id)));
}
