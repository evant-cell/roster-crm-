// Small DOM and formatting helpers shared across views.

export const STAGES = ['new', 'contacted', 'qualified', 'contracted', 'lost'];
export const DEFAULT_STAGE_LABEL = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', contracted: 'Contracted', lost: 'Lost' };
// Mutable on purpose. applyStageLabels overwrites it from settings so every
// view picks up renamed stages without passing settings around.
export const STAGE_LABEL = { ...DEFAULT_STAGE_LABEL };

export function applyStageLabels(settings) {
  const custom = (settings && settings.stage_labels) || {};
  STAGES.forEach((s) => { STAGE_LABEL[s] = (custom[s] && String(custom[s]).trim()) || DEFAULT_STAGE_LABEL[s]; });
}

export const DEFAULT_SOURCES = ['Referral', 'Website form', 'LinkedIn', 'Instagram', 'Networking event', 'Cold outreach', 'Manual', 'Import'];
export const FIELD_TYPES = ['text', 'number', 'currency', 'date', 'dropdown'];

export function sourceOptions(settings) {
  const list = settings && Array.isArray(settings.source_options) ? settings.source_options.filter(Boolean) : [];
  return list.length ? list : DEFAULT_SOURCES;
}

export function customFields(settings) {
  return settings && Array.isArray(settings.custom_fields) ? settings.custom_fields : [];
}

// Sort key for a custom field column, understood by GET /api/leads.
export const customSortKey = (f) => `custom.${f.key}`;

// Puts an up or down arrow on the sorted header button and clears the rest.
export function markSorted(buttons, attr, key, dir) {
  buttons.forEach((b) => {
    const on = b.dataset[attr] === key;
    b.classList.toggle('sorted', on);
    b.textContent = b.textContent.replace(/[ ↑↓]+$/, '') + (on ? (dir > 0 ? ' ↑' : ' ↓') : '');
  });
}

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function today9() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 9, 0, 0);
}

function parseIso9(iso) {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day, 9, 0, 0);
}

export const days = (iso) => {
  if (!iso) return null;
  return Math.round((parseIso9(iso) - today9()) / 86400000);
};

export const fmt = (iso) => (iso ? parseIso9(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

export const rel = (iso) => {
  const n = days(iso);
  if (n === null) return 'never';
  if (n === 0) return 'today';
  if (n === -1) return 'yesterday';
  if (n < 0) return `${-n}d ago`;
  if (n === 1) return 'tomorrow';
  return `in ${n}d`;
};

export const money = (n) => '$' + Number(n || 0).toLocaleString();

export const initials = (n) => String(n || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '--';

export function dueClass(iso) {
  const n = days(iso);
  if (n === null) return 'none';
  if (n < 0) return 'over';
  if (n === 0) return 'today';
  return '';
}

export function dueText(iso) {
  if (!iso) return 'none set';
  const n = days(iso);
  if (n < 0) return `${fmt(iso)} (${-n}d overdue)`;
  if (n === 0) return 'Today';
  return fmt(iso);
}

// Returns the local YYYY-MM-DD date string n days from today.
export function isoOffset(n) {
  const x = today9();
  x.setDate(x.getDate() + n);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isOpen(lead) {
  return lead.stage !== 'lost' && lead.stage !== 'contracted';
}

export function updateNavCounts(counts, totals) {
  const leadsEl = $('#n-leads');
  const followEl = $('#n-follow');
  const contactsEl = $('#n-contacts');
  if (counts && leadsEl) leadsEl.textContent = counts.all ?? 0;
  if (counts && followEl) followEl.textContent = (counts.overdue || 0) + (counts.today || 0);
  if (totals && contactsEl) contactsEl.textContent = totals.contacts ?? 0;
  if (totals && leadsEl) leadsEl.textContent = totals.leads ?? 0;
}

let toastTimer = null;
export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
