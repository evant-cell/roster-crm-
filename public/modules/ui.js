// Small DOM and formatting helpers shared across views.

export const STAGES = ['new', 'contacted', 'qualified', 'contracted', 'lost'];
export const STAGE_LABEL = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', contracted: 'Contracted', lost: 'Lost' };

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

export function updateNavCounts(counts) {
  const leadsEl = $('#n-leads');
  const followEl = $('#n-follow');
  if (leadsEl) leadsEl.textContent = counts.all ?? 0;
  if (followEl) followEl.textContent = (counts.overdue || 0) + (counts.today || 0);
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
