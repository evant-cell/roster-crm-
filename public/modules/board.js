// Kanban board view, grouped by stage.

import { $, $$, esc, money, rel, dueClass, isOpen, toast, STAGE_LABEL, STAGES } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';
import { openLead } from './drawer.js';

// Set right before a click follows a drop, so the click handler can ignore it.
let justDragged = false;

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
    return `<div class="col" data-stage="${s}"><div class="col-h"><span class="stage ${s}">${STAGE_LABEL[s]}</span><span class="n">${arr.length} · ${money(total)}</span></div><div class="col-b" data-stage="${s}">${
      arr.map((l) => `
      <div class="card" data-id="${l.id}" data-stage="${s}" draggable="true" tabindex="0"><div class="name">${esc(l.name)}</div><div class="co">${esc(l.company)}</div>
      <div class="meta"><span class="val">${money(l.est_value)}</span><span class="due ${isOpen(l) ? dueClass(l.next_followup) : 'none'}">${isOpen(l) ? (l.next_followup ? rel(l.next_followup) : 'no date') : ''}</span></div>
      <select class="card-stage-mobile">${STAGES.map((st) => `<option value="${st}" ${st === s ? 'selected' : ''}>${STAGE_LABEL[st]}</option>`).join('')}</select>
      </div>`).join('') || '<div class="empty" style="padding:24px 8px;font-size:12.5px">Empty</div>'
    }</div></div>`;
  }).join('');

  $$('#board .card').forEach((c) => {
    c.addEventListener('click', () => {
      if (justDragged) { justDragged = false; return; }
      openLead(c.dataset.id);
    });
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') openLead(c.dataset.id); });

    c.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', c.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      c.classList.add('dragging');
    });
    c.addEventListener('dragend', () => {
      c.classList.remove('dragging');
      $$('#board .drop-target').forEach((el) => el.classList.remove('drop-target'));
    });

    const select = $('.card-stage-mobile', c);
    select.addEventListener('click', (e) => e.stopPropagation());
    select.addEventListener('change', async () => {
      const id = c.dataset.id;
      const stage = select.value;
      if (stage === c.dataset.stage) return;
      try {
        await api.updateLead(id, { stage });
      } catch (e) {
        toast(e.message);
      }
      renderBoard();
    });
  });

  $$('#board .col-b').forEach((colB) => {
    colB.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      colB.classList.add('drop-target');
    });
    colB.addEventListener('dragleave', (e) => {
      if (!colB.contains(e.relatedTarget)) colB.classList.remove('drop-target');
    });
    colB.addEventListener('drop', async (e) => {
      e.preventDefault();
      colB.classList.remove('drop-target');
      const id = e.dataTransfer.getData('text/plain');
      const card = $(`.card[data-id="${id}"]`);
      const stage = colB.dataset.stage;
      if (!card || card.dataset.stage === stage) return;

      justDragged = true;
      const prevParent = card.parentElement;
      const prevNext = card.nextSibling;
      colB.appendChild(card);

      try {
        await api.updateLead(id, { stage });
      } catch (err) {
        toast(err.message);
        prevParent.insertBefore(card, prevNext);
      }
      renderBoard();
    });
  });
}
