// Date helpers. Roster is single-timezone (America/Chicago) since it is a
// single-user app, so "today" for stage logic and stale/overdue filters is
// always computed in that zone regardless of where the Worker runs.

const CHICAGO_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Returns today's date in America/Chicago as YYYY-MM-DD.
export function todayChicago() {
  return CHICAGO_FORMATTER.format(new Date());
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(isoA, isoB) {
  const [ay, am, ad] = isoA.split('-').map(Number);
  const [by, bm, bd] = isoB.split('-').map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

// Best-effort loose date parser for CSV import. Accepts MM/DD/YYYY,
// YYYY-MM-DD, and "Month D, YYYY" style strings. Returns YYYY-MM-DD or null.
export function parseLooseDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return isoFrom(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    return isoFrom(year, Number(m[1]), Number(m[2]));
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return isoFrom(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return null;
}

function isoFrom(year, month, day) {
  if (!year || !month || !day) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
