import { readSession, deleteSession, clearCookie, COOKIE } from '../../lib/session.js';

export async function onRequestPost({ request, env }) {
  const session = await readSession(env, request);
  if (session) await deleteSession(env, session.id);
  const headers = new Headers();
  headers.append('content-type', 'application/json');
  headers.append('set-cookie', clearCookie(COOKIE.session));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
