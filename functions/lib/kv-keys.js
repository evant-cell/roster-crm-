export const KV = {
  refresh: (email) => `oauth:refresh:${email}`,
  access: (email) => `oauth:access:${email}`,
  session: (id) => `session:${id}`,
};

export const COOKIE = {
  session: 'roster_session',
  pkce: 'roster_pkce',
};

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const PKCE_TTL_SECONDS = 60 * 10;
