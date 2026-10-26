// Central mutable state for the app. Views read and mutate this object directly.

export const state = {
  view: 'leads',
  filter: 'all',
  query: '',
  sortKey: 'next_followup',
  sortDir: 1,
  contactSortKey: 'name',
  contactSortDir: 1,
  // Contacts dropdown column filters, keyed by custom field key. Missing or null
  // means show all, '' means only blank, anything else is that option.
  contactFieldFilter: {},
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
