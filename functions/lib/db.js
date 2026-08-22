// Tiny PostgREST client. Talks to Supabase's auto-generated REST API using
// the service-role key. Never exposed to the frontend, Functions-only.

function baseHeaders(env, extra = {}) {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'content-type': 'application/json',
    ...extra,
  };
}

async function handle(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostgREST ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// filters: array of PostgREST query strings, e.g. ["stage=eq.new", "email=neq."]
export async function query(env, table, { select, filters = [], order, limit } = {}) {
  const params = new URLSearchParams();
  if (select) params.set('select', select);
  if (order) params.set('order', order);
  if (limit != null) params.set('limit', String(limit));
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  const extraQuery = filters.length ? `&${filters.join('&')}` : '';
  const res = await fetch(url + extraQuery, {
    method: 'GET',
    headers: baseHeaders(env),
  });
  return handle(res);
}

export async function insert(env, table, rows, { returning = true } = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: baseHeaders(env, {
      prefer: returning ? 'return=representation' : 'return=minimal',
    }),
    body: JSON.stringify(rows),
  });
  return handle(res);
}

export async function update(env, table, filters, patch) {
  const query = filters.length ? `?${filters.join('&')}` : '';
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: 'PATCH',
    headers: baseHeaders(env, { prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  return handle(res);
}

export async function remove(env, table, filters) {
  const query = filters.length ? `?${filters.join('&')}` : '';
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: 'DELETE',
    headers: baseHeaders(env, { prefer: 'return=representation' }),
  });
  return handle(res);
}

export async function upsert(env, table, rows, onConflict) {
  const params = new URLSearchParams();
  if (onConflict) params.set('on_conflict', onConflict);
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    method: 'POST',
    headers: baseHeaders(env, {
      prefer: 'resolution=merge-duplicates,return=representation',
    }),
    body: JSON.stringify(rows),
  });
  return handle(res);
}
