// Shared header-guessing and stage-normalizing logic for CSV import.

export const IMPORT_FIELDS = [
  'name', 'email', 'company', 'phone', 'stage', 'last_contacted',
  'next_followup', 'notes', 'source', 'tags', 'est_value', 'skip',
];

const HEADER_GUESSES = {
  'full name': 'name',
  'name': 'name',
  'contact': 'name',
  'email': 'email',
  'email address': 'email',
  'company': 'company',
  'business': 'company',
  'organization': 'company',
  'phone': 'phone',
  'contact number': 'phone',
  'mobile': 'phone',
  'status': 'stage',
  'stage': 'stage',
  'last contacted': 'last_contacted',
  'last touch': 'last_contacted',
  'last contact': 'last_contacted',
  'next follow up': 'next_followup',
  'follow up': 'next_followup',
  'notes': 'notes',
  'note': 'notes',
  'comments': 'notes',
  'source': 'source',
  'tags': 'tags',
  'value': 'est_value',
};

export function guessField(header) {
  const key = String(header || '').trim().toLowerCase();
  return HEADER_GUESSES[key] || 'skip';
}

export function guessMapping(headers) {
  const guesses = {};
  for (const header of headers) {
    guesses[header] = guessField(header);
  }
  return guesses;
}

const STAGE_ALIASES = {
  new: 'new',
  contacted: 'contacted',
  reached: 'contacted',
  qualified: 'qualified',
  qualifying: 'qualified',
  contracted: 'contracted',
  won: 'contracted',
  signed: 'contracted',
  closed: 'contracted',
  'closed won': 'contracted',
  lost: 'lost',
  'closed lost': 'lost',
  dead: 'lost',
};

// Best-effort mapping from an arbitrary incoming stage string to one of the
// five canonical stages. Unknown values fall back to 'new'.
export function normalizeStage(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return 'new';
  return STAGE_ALIASES[key] || 'new';
}
