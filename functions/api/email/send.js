import { getAccessToken } from '../../lib/google.js';
import { KV } from '../../lib/kv-keys.js';
import { insert, update } from '../../lib/db.js';
import { json, error, readJson, isUuid } from '../../lib/http.js';
import { todayChicago } from '../../lib/dates.js';

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64urlEncode(str) {
  return b64Encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// A header value has to stay on one line. Collapsing CR and LF stops a
// subject or recipient from injecting extra headers into the message.
function headerValue(value) {
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim();
}

// RFC 2047 encoded word, so a non-ASCII subject survives the wire intact.
function encodeSubject(value) {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${b64Encode(value)}?=`;
}

function buildRfc2822({ from, to, subject, body }) {
  const lines = [
    `From: ${headerValue(from)}`,
    `To: ${headerValue(to)}`,
    `Subject: ${encodeSubject(headerValue(subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ];
  return lines.join('\r\n');
}

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (body === null) return error('Invalid JSON body.');

  const { lead_id, to, subject, body: messageBody } = body;
  if (!lead_id || !to || !subject) return error('lead_id, to, and subject are required.');
  if (!isUuid(lead_id)) return error('Invalid lead id.');

  const recipient = headerValue(to);
  if (!EMAIL_RE.test(recipient)) return error('Enter one valid recipient address.');

  // The sender is always the signed-in account from the ID token claim, never
  // anything the caller supplied. ALLOWED_EMAIL is a list now, so it is not a
  // usable fallback here.
  const fromEmail = data && data.session ? data.session.email : null;
  if (!fromEmail) return error('Sign in again before sending.', 401);

  let accessToken;
  try {
    accessToken = await getAccessToken(env, fromEmail);
  } catch (e) {
    return error('Could not get a Gmail access token. Reconnect your Google account.', 401);
  }

  const raw = b64urlEncode(buildRfc2822({ from: fromEmail, to: recipient, subject, body: messageBody || '' }));

  let res;
  try {
    res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
  } catch (e) {
    return error(`Network error contacting Gmail: ${e.message}`, 502);
  }

  if (res.status === 401 || res.status === 403) {
    // The cached access token is stale or the grant was revoked. Drop the
    // cache so the next attempt refreshes instead of replaying a dead token.
    try {
      await env.KV.delete(KV.access(fromEmail));
    } catch {
      // Cache eviction is best-effort, the TTL clears it either way.
    }
    return error('Gmail rejected the request. Reconnect your Google account and try again.', res.status);
  }
  if (!res.ok) {
    const text = await res.text();
    return error(`Gmail send failed: ${res.status} ${text}`, 502);
  }

  const sent = await res.json();

  try {
    await insert(env, 'activities', [{ lead_id, type: 'email', body: `Sent: ${subject}` }], { returning: false });
    await update(env, 'leads', [`id=eq.${lead_id}`], { last_contacted: todayChicago() });
  } catch {
    // Email already sent, follow-up bookkeeping is best-effort.
  }

  return json({ ok: true, messageId: sent.id });
}
