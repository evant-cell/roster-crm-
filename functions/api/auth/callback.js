import { exchangeCode, decodeIdToken } from '../../lib/google.js';
import {
  parseCookies,
  verifyValue,
  createSession,
  clearCookie,
  COOKIE,
} from '../../lib/session.js';
import { KV } from '../../lib/kv-keys.js';

function errorPage(message, status = 400) {
  const safe = String(message).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Sign-in error</title><style>body{font-family:system-ui;background:#F2F4F1;color:#171F1C;padding:48px;max-width:640px;margin:0 auto}h1{margin-top:0}a{color:#1E6B58}</style></head><body><h1>Sign-in error</h1><p>${safe}</p><p><a href="/">Back to app</a></p></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return errorPage('Missing code or state.');

  const cookies = parseCookies(request);
  const signed = cookies[COOKIE.pkce];
  const verified = await verifyValue(signed, env.SESSION_SECRET);
  if (!verified) return errorPage('PKCE cookie missing or invalid. Try signing in again.');

  let payload;
  try {
    payload = JSON.parse(atob(verified));
  } catch {
    return errorPage('PKCE payload corrupt.');
  }
  if (payload.state !== state) return errorPage('State mismatch.');

  let tokens;
  try {
    tokens = await exchangeCode({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: payload.redirectUri,
      code,
      codeVerifier: payload.verifier,
    });
  } catch (e) {
    return errorPage(e.message);
  }

  let id;
  try {
    id = decodeIdToken(tokens.id_token);
  } catch {
    return errorPage('Could not decode ID token.');
  }

  const allowed = (env.ALLOWED_EMAIL || '').trim().toLowerCase();
  const idEmail = (id.email || '').trim().toLowerCase();
  if (!id.email_verified || !allowed || idEmail !== allowed) {
    // Discard tokens, do not persist anything for a non-allowlisted account.
    return errorPage('This Google account is not authorized.', 403);
  }
  if (!tokens.refresh_token) {
    return errorPage('No refresh token returned. Revoke the app at myaccount.google.com and try again.');
  }

  await env.KV.put(KV.refresh, tokens.refresh_token);
  const expiresAt = Date.now() + Math.max(0, tokens.expires_in - 60) * 1000;
  await env.KV.put(
    KV.access,
    JSON.stringify({ token: tokens.access_token, expiresAt }),
    { expirationTtl: Math.max(60, tokens.expires_in - 60) }
  );

  const session = await createSession(env, id.email);

  const headers = new Headers();
  headers.append('location', '/');
  headers.append('set-cookie', session.cookie);
  headers.append('set-cookie', clearCookie(COOKIE.pkce));
  return new Response(null, { status: 302, headers });
}
