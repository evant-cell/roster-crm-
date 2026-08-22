// Follow-ups view: overdue, due today, due this week, plus a stale-contact banner.

import { $, $$, esc, fmt, rel, days, isoOffset, toast, STAGE_LABEL, updateNavCounts } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';
import { openLead } from './drawer.js';
import { setView } from '../app.js';

export async function renderFollow() {
  let overdue, dueToday, everything;
  try {
    [overdue, dueToday, everything] = await Promise.all([
      api.getLeads({ filter: 'overdue', sort: 'next_followup', dir: 'asc' }),
      api.getLeads({ filter: 'today', sort: 'next_followup', dir: 'asc' }),
      api.getLeads({ sort: 'next_followup', dir: 'asc' }),
    ]);
  } catch (e) {
    toast(e.message);
    return;
  }
  state.counts = overdue.counts;
  updateNavCounts(state.counts);

  const week = everything.leads
    .filter((l) => l.stage !== 'lost' && l.stage !== 'contracted' && l.next_followup && days(l.next_followup) > 0 && days(l.next_followup) <= 7)
    .sort((a, b) => (a.next_followup < b.next_followup ? -1 : 1));

  const staleCount = overdue.counts.stale || 0;

  const sec = (title, color, arr, why) => `<div class="section"><div class="section-h"><span class="dot" style="background:${color}"></span>${title}<span class="n">${arr.length}</span></div>${
    arr.length
      ? arr.map((l) => `
    <div class="frow" data-id="${l.id}"><div><div class="name">${esc(l.name)} <span class="co">${esc(l.company)}</span></div><div class="why">${why(l)}</div></div><span class="stage ${l.stage}">${STAGE_LABEL[l.stage]}</span>
    <div class="acts"><button class="btn sm" data-act="done" data-id="${l.id}">Log touch</button><button class="btn sm ghost" data-act="snooze" data-id="${l.id}">Snooze 3d</button></div></div>`).join('')
      : '<div class="empty" style="padding:22px">Nothing here.</div>'
  }</div>`;

  $('#follow').innerHTML =
    sec('Overdue', 'var(--red)', overdue.leads, (l) => `Was due ${fmt(l.next_followup)}, ${-days(l.next_followup)} days ago. Last contact ${rel(l.last_contacted)}.`) +
    sec('Due today', 'var(--gold)', dueToday.leads, (l) => `${l.notes ? esc(l.notes) : 'No notes yet.'}`) +
    sec('This week', 'var(--blue)', week, (l) => `Due ${fmt(l.next_followup)}. ${esc(l.notes || '')}`) +
    (staleCount ? `<div class="note-banner"><b>${staleCount} lead${staleCount > 1 ? 's have' : ' has'}</b> had no contact in ${state.settings ? state.settings.stale_days : 14}+ days. <button class="btn sm" style="margin-left:auto" id="go-stale">Show them</button></div>` : '');

  $$('#follow .frow').forEach((row) => row.addEventListener('click', (e) => { if (e.target.closest('button')) return; openLead(row.dataset.id); }));
  $$('#follow [data-act]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.id;
    try {
      if (b.dataset.act === 'done') {
        const { lead } = await api.addActivity(id, { type: 'call', body: 'Touch logged from follow-ups list.', touch: true });
        await api.updateLead(id, { next_followup: isoOffset(7) });
        toast(`Logged. ${lead.name} is due again ${fmt(isoOffset(7))}.`);
      } else {
        const lead = await api.snoozeLead(id, 3);
        toast(`Snoozed ${lead.name} to ${fmt(lead.next_followup)}.`);
      }
      renderFollow();
    } catch (e) {
      toast(e.message);
    }
  }));
  const goStale = $('#go-stale');
  if (goStale) goStale.addEventListener('click', () => {
    state.filter = 'stale';
    setView('leads');
  });
}
