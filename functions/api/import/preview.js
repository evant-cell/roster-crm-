import { parseCsv } from '../../lib/csv.js';
import { guessMapping } from '../../lib/leads-map.js';
import { json, error, readJson } from '../../lib/http.js';

export async function onRequestPost({ request }) {
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');
  const csv = body.csv;
  if (typeof csv !== 'string' || !csv.trim()) return error('csv is required.');

  const { headers, rows } = parseCsv(csv);
  if (headers.length === 0) return error('Could not find a header row in that CSV.');

  const sample = rows.slice(0, 3);
  const guesses = guessMapping(headers);

  return json({ headers, rowCount: rows.length, sample, guesses });
}
