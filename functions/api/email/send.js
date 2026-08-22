import { getAccessToken } from '../../lib/google.js';
import { insert, update } from '../../lib/db.js';
import { json, error, readJson } from '../../lib/http.js';
import { todayChicago } from '../../lib/dates.js';

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRfc2822({ from, to, subject, body }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
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

  const fromEmail = data && data.session ? data.session.email : env.ALLOWED_EMAIL;

  let accessToken;
  try {
    accessToken = await getAccessToken(env, fromEmail);
  } catch (e) {
    return error('Could not get a Gmail access token. Reconnect your Google account.', 401);
  }

  const raw = b64urlEncode(buildRfc2822({ from: fromEmail, to, subject, body: messageBody || '' }));

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
