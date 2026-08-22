import { KV, COOKIE, SESSION_TTL_SECONDS, PKCE_TTL_SECONDS } from './kv-keys.js';

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? 0 : 4 - (str.length % 4);
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signValue(value, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return `${value}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyValue(signed, secret) {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  let sigBytes;
  try {
    sigBytes = b64urlDecode(sig);
  } catch {
    // A tampered or truncated cookie is not valid base64url. Treat it as a
    // failed signature instead of letting atob throw out of the request.
    return null;
  }
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(value));
  return ok ? value : null;
}

export function parseCookies(req) {
  const header = req.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq)] = decodeURIComponent(trimmed.slice(eq + 1));
  }
  return out;
}

export function buildCookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push('HttpOnly');
  parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function clearCookie(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function randomId(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64urlEncode(buf);
}

export async function createSession(env, email) {
  const id = randomId(32);
  const record = { email, issuedAt: Date.now() };
  await env.KV.put(KV.session(id), JSON.stringify(record), { expirationTtl: SESSION_TTL_SECONDS });
  const signed = await signValue(id, env.SESSION_SECRET);
  return { id, signedId: signed, cookie: buildCookie(COOKIE.session, signed, { maxAge: SESSION_TTL_SECONDS }) };
}

export async function readSession(env, req) {
  const cookies = parseCookies(req);
  const signed = cookies[COOKIE.session];
  if (!signed) return null;
  const id = await verifyValue(signed, env.SESSION_SECRET);
  if (!id) return null;
  const raw = await env.KV.get(KV.session(id));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    return { id, ...record };
  } catch {
    return null;
  }
}

export async function deleteSession(env, id) {
  await env.KV.delete(KV.session(id));
}

export { PKCE_TTL_SECONDS, SESSION_TTL_SECONDS, COOKIE, KV };
