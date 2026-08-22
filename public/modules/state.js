// Central mutable state for the app. Views read and mutate this object directly.

export const state = {
  view: 'leads',
  filter: 'all',
  query: '',
  sortKey: 'next_followup',
  sortDir: 1,
  selected: null,
  leads: [],
  counts: { all: 0, new: 0, contacted: 0, qualified: 0, contracted: 0, lost: 0, overdue: 0, stale: 0, today: 0 },
  settings: null,
  email: '',
  importStep: 1,
  importFile: { name: '', csv: '' },
  importPreview: null,
  importResult: null,
};
