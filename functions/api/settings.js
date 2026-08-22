import { query, upsert } from '../lib/db.js';
import { json, error, readJson } from '../lib/http.js';

export async function onRequestGet({ env }) {
  let rows;
  try {
    rows = await query(env, 'settings', { select: 'key,value' });
  } catch (e) {
    return error(e.message, 502);
  }
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return json(out);
}

export async function onRequestPut({ request, env }) {
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  const keys = Object.keys(body);
  if (keys.length === 0) return error('No settings provided.');

  const rows = keys.map((key) => ({ key, value: body[key] }));
  try {
    await upsert(env, 'settings', rows, 'key');
  } catch (e) {
    return error(e.message, 502);
  }

  let allRows;
  try {
    allRows = await query(env, 'settings', { select: 'key,value' });
  } catch (e) {
    return error(e.message, 502);
  }
  const out = {};
  for (const row of allRows) out[row.key] = row.value;
  return json(out);
}
