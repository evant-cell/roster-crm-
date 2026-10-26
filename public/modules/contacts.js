// Contacts view: everyone who is not in the pipeline yet. Each row has a
// Make lead button that moves the person into Leads at the first stage.

import { $, $$, esc, toast, updateNavCounts, customSortKey, markSorted } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';
import { openLead } from './drawer.js';
import { listFields, customCell } from './leads.js';
import { applyFieldFilters, paintFieldFilters } from './field-filter.js';

function headerCell(f) {
  const th = document.createElement('th');
  th.className = 'cf';
  const btn = document.createElement('button');
  btn.dataset.csort = customSortKey(f);
  btn.textContent = f.label;
  th.appendChild(btn);
  return th;
}

// Same column layout as the Leads list: "start" custom columns before Name,
// "end" custom columns just before Notes.
function paintHeaders(startFields, endFields) {
  const row = $('#contacts-head');
  $$('th.cf', row).forEach((th) => th.remove());
  const nameHeader = row.firstElementChild;
  const notesHeader = row.children[row.children.length - 2];
  startFields.forEach((f) => row.insertBefore(headerCell(f), nameHeader));
  endFields.forEach((f) => row.insertBefore(headerCell(f), notesHeader));
}

export async function makeLead(id, name) {
  await api.updateLead(id, { is_contact: false, stage: 'new' });
  toast(`${name || 'Contact'} is now a lead`);
}

export async function renderContacts() {
  let data;
  try {
    data = await api.getLeads({ kind: 'contacts', q: state.query || undefined, sort: state.contactSortKey, dir: state.contactSortDir > 0 ? 'asc' : 'desc' });
  } catch (e) {
    toast(e.message);
    data = { leads: [], totals: null };
  }
  const loaded = data.leads;
  const contacts = applyFieldFilters(loaded, state.contactFieldFilter, state.settings);
  paintFieldFilters($('#contact-cf'), loaded, state.contactFieldFilter, state.settings, renderContacts);
  updateNavCounts(null, data.totals);

  const startFields = listFields('start');
  const endFields = listFields('end');
  paintHeaders(startFields, endFields);

  const sortButtons = $$('#contacts-head button[data-csort]');
  markSorted(sortButtons, 'csort', state.contactSortKey, state.contactSortDir);
  sortButtons.forEach((b) => {
    b.onclick = () => {
      if (state.contactSortKey === b.dataset.csort) state.contactSortDir *= -1;
      else { state.contactSortKey = b.dataset.csort; state.contactSortDir = 1; }
      renderContacts();
    };
  });

  const total = data.totals ? data.totals.contacts : contacts.length;
  $('#contact-count').textContent = contacts.length === total ? `${total} contact${total === 1 ? '' : 's'}` : `${contacts.length} of ${total}`;

  const cols = 6 + startFields.length + endFields.length;
  $('#contact-rows').innerHTML = contacts.length
    ? contacts.map((c) => `<tr data-id="${c.id}">
        ${startFields.map((f) => `<td class="cf">${customCell(f, c)}</td>`).join('')}
        <td><div class="name">${esc(c.name)}</div></td>
        <td>${c.company ? esc(c.company) : '<span class="co">no company</span>'}</td>
        <td><div style="font-size:12.5px">${esc(c.email)}</div><div class="co mono">${esc(c.phone)}</div></td>
        <td>${(c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</td>
        ${endFields.map((f) => `<td class="cf">${customCell(f, c)}</td>`).join('')}
        <td class="notes" title="${esc(c.notes)}"><div>${esc(c.notes).replace(/\n+/g, ' &middot; ')}</div></td>
        <td class="act"><button class="btn sm" data-make="${c.id}">Make lead</button></td>
      </tr>`).join('')
    : `<tr><td colspan="${cols}" class="empty">${loaded.length ? 'No contacts match. Try All or clear the search.' : 'No contacts yet. Import a list or add one with + New contact.'}</td></tr>`;

  const order = $$('#contact-rows tr[data-id]').map((row) => row.dataset.id);
  $$('#contact-rows tr[data-id]').forEach((row) => row.addEventListener('click', () => openLead(row.dataset.id, { list: order })));
  $$('#contact-rows [data-make]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    b.disabled = true;
    const c = contacts.find((x) => String(x.id) === b.dataset.make);
    try {
      await makeLead(b.dataset.make, c && c.name);
      renderContacts();
    } catch (err) {
      toast(err.message);
      b.disabled = false;
    }
  }));
}
