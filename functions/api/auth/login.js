import { generateState, generatePkceVerifier, pkceChallenge, buildAuthUrl } from '../../lib/google.js';
import { signValue, buildCookie, COOKIE, PKCE_TTL_SECONDS } from '../../lib/session.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/callback`;

  const state = generateState();
  const verifier = generatePkceVerifier();
  const challenge = await pkceChallenge(verifier);

  const payload = JSON.stringify({ state, verifier, redirectUri });
  const signed = await signValue(btoa(payload), env.SESSION_SECRET);

  const target = buildAuthUrl({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  const headers = new Headers();
  headers.append('location', target);
  headers.append('set-cookie', buildCookie(COOKIE.pkce, signed, { maxAge: PKCE_TTL_SECONDS }));
  return new Response(null, { status: 302, headers });
}
