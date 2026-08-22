import { readSession } from '../../lib/session.js';

export async function onRequestGet({ request, env }) {
  const session = await readSession(env, request);
  if (!session) {
    return new Response(JSON.stringify({ loggedIn: false, email: null }), {
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ loggedIn: true, email: session.email }), {
    headers: { 'content-type': 'application/json' },
  });
}
