// Boot: check auth, wire global chrome (nav, search, theme, drawer scrim,
// keyboard shortcuts), and dispatch rendering to the active view module.

import { $, $$, toast, initials } from './modules/ui.js';
import { state } from './modules/state.js';
import * as api from './modules/api.js';
import { renderLeads } from './modules/leads.js';
import { renderBoard } from './modules/board.js';
import { renderFollow } from './modules/followups.js';
import { renderImport } from './modules/import.js';
import { renderSettings } from './modules/settings.js';
import { openLead, closeDrawer } from './modules/drawer.js';

const TITLES = { leads: 'Leads', board: 'Board', follow: 'Follow-ups', import: 'Import leads', settings: 'Settings' };
const DEFAULT_SUBS = { leads: '', board: 'Click a card to open it', follow: 'Overdue first, then today, then this week', import: 'CSV export from any spreadsheet', settings: '' };

const RENDERERS = { leads: renderLeads, board: renderBoard, follow: renderFollow, import: renderImport, settings: renderSettings };

export function setView(v) {
  state.view = v;
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach((s) => s.classList.toggle('active', s.dataset.view === v));
  $('#title').textContent = TITLES[v];
  $('#subtitle').textContent = DEFAULT_SUBS[v] || '';
  renderCurrent();
}

export function renderCurrent() {
  const fn = RENDERERS[state.view];
  if (fn) fn();
}

export function refreshCurrentView() {
  renderCurrent();
}

function initTheme() {
  const saved = localStorage.getItem('roster-theme');
  if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
  const isDark = () => {
    const r = document.documentElement;
    return r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const btn = $('#theme');
  btn.textContent = isDark() ? 'Switch to light' : 'Switch to dark';
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('roster-theme', next);
    btn.textContent = next === 'dark' ? 'Switch to light' : 'Switch to dark';
  });
}

function initChrome() {
  $$('#nav button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

  $$('thead th button[data-sort]').forEach((b) => b.addEventListener('click', () => {
    if (state.sortKey === b.dataset.sort) state.sortDir *= -1; else { state.sortKey = b.dataset.sort; state.sortDir = 1; }
    if (state.view === 'leads') renderLeads();
  }));

  let searchTimer = null;
  $('#q').addEventListener('input', (e) => {
    state.query = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (state.view === 'leads' || state.view === 'board') renderCurrent();
    }, 250);
  });

  $('#new-lead').addEventListener('click', async () => {
    try {
      const lead = await api.createLead({ name: 'New lead', stage: 'new' });
      renderCurrent();
      await openLead(lead.id, { focusName: true });
    } catch (e) {
      toast(e.message);
    }
  });

  $('#scrim').addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      $('#q').focus();
    }
  });

  $('#signout').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await api.logout();
    } catch (err) {
      // fall through to reload regardless
    }
    location.reload();
  });
}

async function boot() {
  initTheme();
  let status;
  try {
    status = await api.authStatus();
  } catch (e) {
    status = { loggedIn: false };
  }
  if (!status.loggedIn) {
    $('#login-screen').classList.remove('hidden');
    $('#app').classList.add('hidden');
    return;
  }
  state.email = status.email || '';
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#who-email').textContent = state.email;
  $('#who-avatar').textContent = initials(state.email.split('@')[0].replace(/[._]/g, ' '));

  try {
    state.settings = await api.getSettings();
  } catch (e) {
    // settings.js will retry and fall back to defaults
  }

  initChrome();
  setView('leads');
}

boot();
