import { KV } from './kv-keys.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = 'openid email https://www.googleapis.com/auth/gmail.send';

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBytes(n) {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

export function generateState() {
  return b64urlEncode(randomBytes(24));
}

export function generatePkceVerifier() {
  return b64urlEncode(randomBytes(48));
}

export async function pkceChallenge(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
  return b64urlEncode(new Uint8Array(hash));
}

export function buildAuthUrl({ clientId, redirectUri, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode({ clientId, clientSecret, redirectUri, code, codeVerifier }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccess({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export function decodeIdToken(idToken) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Bad ID token');
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

// Returns a fresh Gmail access token, refreshing via the stored refresh token
// when the cached access token is missing or close to expiry.
export async function getAccessToken(env, email) {
  const cached = await env.KV.get(KV.access(email), { type: 'json' });
  if (cached && cached.expiresAt > Date.now() + 5000) {
    return cached.token;
  }
  const refresh = await env.KV.get(KV.refresh(email));
  if (!refresh) throw new Error('No refresh token; sign in required.');
  const tok = await refreshAccess({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    refreshToken: refresh,
  });
  const expiresAt = Date.now() + Math.max(0, tok.expires_in - 60) * 1000;
  await env.KV.put(
    KV.access(email),
    JSON.stringify({ token: tok.access_token, expiresAt }),
    { expirationTtl: Math.max(60, tok.expires_in - 60) }
  );
  return tok.access_token;
}

export { SCOPE };
