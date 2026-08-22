export const KV = {
  refresh: 'oauth:refresh',
  access: 'oauth:access',
  session: (id) => `session:${id}`,
};

export const COOKIE = {
  session: 'roster_session',
  pkce: 'roster_pkce',
};

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const PKCE_TTL_SECONDS = 60 * 10;
