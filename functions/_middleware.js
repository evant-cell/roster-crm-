import { readSession } from './lib/session.js';

const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/logout',
  '/api/auth/status',
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith('/api/')) {
    return context.next();
  }
  if (PUBLIC_PATHS.has(url.pathname)) {
    return context.next();
  }
  const session = await readSession(context.env, context.request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  context.data.session = session;
  return context.next();
}
