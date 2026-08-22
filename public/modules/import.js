// CSV import wizard: upload -> match columns -> review and commit.

import { $, $$, esc, toast } from './ui.js';
import { state } from './state.js';
import * as api from './api.js';
import { setView } from '../app.js';

const FIELD_TARGETS = [
  ['name', 'Name'], ['email', 'Email'], ['company', 'Company'], ['phone', 'Phone'],
  ['stage', 'Stage'], ['last_contacted', 'Last contacted'], ['next_followup', 'Next follow-up'],
  ['notes', 'Notes'], ['source', 'Source'], ['tags', 'Tags'], ['est_value', 'Est. value'],
  ['skip', 'Skip this column'],
];

let mapping = {};

function goStep(n) {
  state.importStep = n;
  renderImport();
}

export function renderImport() {
  $$('#steps .step').forEach((s, i) => {
    s.classList.toggle('on', i + 1 === state.importStep);
    s.classList.toggle('done', i + 1 < state.importStep);
  });
  const p = $('#import-panel');
  if (state.importStep === 1) paintStep1(p);
  else if (state.importStep === 2) paintStep2(p);
  else paintStep3(p);
}

function paintStep1(p) {
  p.innerHTML = `<div class="drop" id="drop" tabindex="0"><b>Drop your spreadsheet here</b><span>CSV export from any spreadsheet</span><span class="or">or</span><button class="btn sm" id="choose">Choose file</button></div>
    <input type="file" id="file-input" accept=".csv,text/csv" class="hidden">
    <div class="pfoot"><span class="hint">Nothing is saved until step 3. Duplicate emails are merged, not doubled.</span></div>`;

  const drop = $('#drop');
  const fileInput = $('#file-input');
  const openPicker = (e) => { if (e) e.stopPropagation(); fileInput.click(); };
  $('#choose').addEventListener('click', openPicker);
  drop.addEventListener('click', openPicker);
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter') openPicker(); });
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) loadFile(f);
  });
}

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    state.importFile = { name: file.name, csv: String(reader.result || '') };
    goStep(2);
  };
  reader.onerror = () => toast('Could not read that file');
  reader.readAsText(file);
}

async function paintStep2(p) {
  p.innerHTML = `<div class="hint">Reading ${esc(state.importFile.name)}&hellip;</div>`;
  let preview;
  try {
    preview = await api.previewImport(state.importFile.csv);
  } catch (e) {
    toast(e.message);
    goStep(1);
    return;
  }
  state.importPreview = preview;
  mapping = {};
  preview.headers.forEach((h) => { mapping[h] = preview.guesses[h] || 'skip'; });

  p.innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px"><b>${esc(state.importFile.name)}</b><span class="hint">${preview.headers.length} columns &middot; ${preview.rowCount} rows &middot; we guessed the matches, fix any that are wrong</span></div>
    <div class="maphead"><span>Column in your file</span><span></span><span>Goes into</span><span>First row</span></div>
    ${preview.headers.map((h, i) => `<div class="maprow"><span class="src">${esc(h)}</span><span class="arr">&rarr;</span><select data-h="${esc(h)}">${FIELD_TARGETS.map(([v, l]) => `<option value="${v}" ${mapping[h] === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="sample">${esc(preview.sample[i] ?? '')}</span></div>`).join('')}
    <div class="pfoot"><button class="btn ghost" id="back1">Back</button><span class="spacer"></span><span class="hint">"Stage" values will be matched to your stages (Contacted, Qualified, Lost, Contracted).</span><button class="btn primary" id="to3">Review</button></div>`;

  $$('#import-panel select[data-h]').forEach((sel) => sel.addEventListener('change', () => { mapping[sel.dataset.h] = sel.value; }));
  $('#back1').addEventListener('click', () => goStep(1));
  $('#to3').addEventListener('click', () => goStep(3));
}

function paintStep3(p) {
  const preview = state.importPreview || { rowCount: 0 };
  p.innerHTML = `<div class="hint">Ready to import ${preview.rowCount} row${preview.rowCount === 1 ? '' : 's'} from ${esc(state.importFile.name)}.</div>
    <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
      <label class="check"><input type="checkbox" id="opt-followup" checked> Set "Next follow-up" to 7 days out for anything without a date</label>
      <label class="check"><input type="checkbox" id="opt-tag" checked> Tag every imported lead <span class="tag" id="opt-tag-label"></span> so you can find them later</label>
    </div>
    <div class="pfoot"><button class="btn ghost" id="back2">Back</button><span class="spacer"></span><button class="btn primary" id="go">Import ${preview.rowCount} lead${preview.rowCount === 1 ? '' : 's'}</button></div>`;

  const tagValue = `import-${new Date().toISOString().slice(0, 10)}`;
  $('#opt-tag-label').textContent = tagValue;
  $('#back2').addEventListener('click', () => goStep(2));
  $('#go').addEventListener('click', async () => {
    const options = {};
    if ($('#opt-followup').checked) options.defaultFollowupDays = 7;
    if ($('#opt-tag').checked) options.tag = tagValue;
    const goBtn = $('#go');
    goBtn.disabled = true;
    try {
      const result = await api.commitImport(state.importFile.csv, mapping, options);
      state.importResult = result;
      paintResult(p, result);
    } catch (e) {
      toast(e.message);
      goBtn.disabled = false;
    }
  });
}

function paintResult(p, result) {
  p.innerHTML = `<div class="summary">
      <div><div class="val">${result.inserted}</div><div class="lbl">New leads added</div></div>
      <div><div class="val">${result.updated}</div><div class="lbl">Matched existing emails (updated)</div></div>
      <div><div class="val" style="color:var(--gold)">${result.missingEmail}</div><div class="lbl">Rows missing an email (kept, flagged)</div></div>
    </div>
    <div class="pfoot"><span class="hint">${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped entirely.</span><span class="spacer"></span><button class="btn primary" id="to-leads">View leads</button></div>`;
  $('#to-leads').addEventListener('click', () => {
    state.importStep = 1;
    state.importFile = { name: '', csv: '' };
    state.importPreview = null;
    toast('Import complete');
    setView('leads');
  });
}
