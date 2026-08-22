// Small response and request helpers shared by every API route.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lead and activity ids are Postgres uuids. Checking the shape here keeps
// request-supplied strings out of PostgREST filter expressions.
export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export async function readJson(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}
