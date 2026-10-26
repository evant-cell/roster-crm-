// Filter buttons for dropdown columns (for example Type) on the Contacts
// list. Filtering happens on the rows already loaded, so the
// counts on each button always match what the list would show.

import { $$, esc, customFields } from './ui.js';

function filterFields(settings) {
  return customFields(settings).filter((f) => f.in_list && f.type === 'dropdown');
}

function valueOf(record, key) {
  const v = (record.custom || {})[key];
  return v === undefined || v === null ? '' : String(v);
}

function matches(record, filters) {
  return Object.entries(filters).every(([key, want]) => {
    if (want === null || want === undefined) return true;
    return valueOf(record, key) === want;
  });
}

// Returns the records that pass every active dropdown filter.
export function applyFieldFilters(records, filters, settings) {
  const active = {};
  filterFields(settings).forEach((f) => { active[f.key] = filters[f.key]; });
  return records.filter((r) => matches(r, active));
}

// Paints one row of buttons per dropdown column into `container`.
// `onChange` runs after a button is clicked, with `filters` already updated.
export function paintFieldFilters(container, records, filters, settings, onChange) {
  const fields = filterFields(settings);
  if (!fields.length) { container.innerHTML = ''; return; }

  container.innerHTML = fields.map((f) => {
    // Counts respect the other columns' filters but not this one.
    const others = { ...filters, [f.key]: null };
    const pool = records.filter((r) => matches(r, others));
    const values = (f.options || []).slice();
    pool.forEach((r) => { const v = valueOf(r, f.key); if (v && !values.includes(v)) values.push(v); });
    const current = filters[f.key];
    const chip = (value, label, n) => {
      const on = value === null ? (current === null || current === undefined) : current === value;
      return `<button class="chip ${on ? 'on' : ''}" data-key="${esc(f.key)}" data-v="${value === null ? '__all' : esc(value)}">${esc(label)}<span class="n">${n}</span></button>`;
    };
    return `<div class="chips field-filter"><span class="ff-label">${esc(f.label)}</span>
      ${chip(null, 'All', pool.length)}
      ${values.map((v) => chip(v, v, pool.filter((r) => valueOf(r, f.key) === v).length)).join('')}
      ${chip('', 'Blank', pool.filter((r) => valueOf(r, f.key) === '').length)}
    </div>`;
  }).join('');

  $$('button[data-key]', container).forEach((b) => {
    b.onclick = () => {
      filters[b.dataset.key] = b.dataset.v === '__all' ? null : b.dataset.v;
      onChange();
    };
  });
}
