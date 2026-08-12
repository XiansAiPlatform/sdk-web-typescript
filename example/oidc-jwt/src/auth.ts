import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts';

/**
 * Shared OIDC UserManager for the oidc-jwt example.
 *
 * Configure via Vite env vars (see `.env.example`). The access_token from the
 * IdP is what we pass into RestSDK / SseSDK via `getJwtToken`.
 */

function requireEnv(name: keyof ImportMetaEnv, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and set your OIDC / server values.`
    );
  }
  return value.trim();
}

const env = import.meta.env;

const authority = requireEnv('VITE_OIDC_AUTHORITY', env.VITE_OIDC_AUTHORITY);
const clientId = requireEnv('VITE_OIDC_CLIENT_ID', env.VITE_OIDC_CLIENT_ID);
// Google "Web application" clients require a secret at the token endpoint even
// with PKCE. Auth0/Keycloak public SPAs leave this empty.
const clientSecret = env.VITE_OIDC_CLIENT_SECRET?.trim() || undefined;
const redirectUri =
  env.VITE_OIDC_REDIRECT_URI?.trim() || `${window.location.origin}/`;
const silentRedirectUri = env.VITE_OIDC_SILENT_REDIRECT_URI?.trim() || undefined;
const postLogoutRedirectUri =
  env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI?.trim() || window.location.origin;
const scope = env.VITE_OIDC_SCOPE?.trim() || 'openid profile email';
const audience = env.VITE_OIDC_AUDIENCE?.trim();
const tokenType =
  env.VITE_OIDC_TOKEN_TYPE?.trim().toLowerCase() === 'id_token'
    ? 'id_token'
    : 'access_token';

/** Shared store so authorize `state` survives the IdP round-trip (same origin). */
const storage = new WebStorageStateStore({ store: window.localStorage });

export const userManager = new UserManager({
  authority,
  client_id: clientId,
  ...(clientSecret ? { client_secret: clientSecret } : {}),
  redirect_uri: redirectUri,
  ...(silentRedirectUri ? { silent_redirect_uri: silentRedirectUri } : {}),
  post_logout_redirect_uri: postLogoutRedirectUri,
  response_type: 'code',
  scope,
  // Prefer refresh_token renew when `offline_access` is requested; iframe silent
  // renew needs a registered silent_redirect_uri (often missing on Azure SPAs).
  automaticSilentRenew: true,
  userStore: storage,
  stateStore: storage,
  ...(audience
    ? { extraQueryParams: { audience } }
    : {}),
});

/** True when the current URL is an OIDC redirect response. */
export function hasOidcCallbackParams(): boolean {
  const params = new URLSearchParams(window.location.search);
  return (
    (params.has('code') && params.has('state')) ||
    (params.has('error') && params.has('state'))
  );
}

/**
 * Cookie name mirrored in vite.config.ts. Native EventSource cannot send
 * Authorization headers; the Vite dev proxy reads this cookie and forwards
 * `Authorization: Bearer …` to UserApi. Local demo only.
 */
export const JWT_DEV_PROXY_COOKIE = 'xians_oidc_jwt';

export function persistJwtForDevProxy(token: string): void {
  document.cookie = `${JWT_DEV_PROXY_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
}

export function clearJwtDevProxyCookie(): void {
  document.cookie = `${JWT_DEV_PROXY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Return a fresh JWT for the SDK (`getJwtToken`), renewing silently if needed.
 *
 * Default: OIDC `access_token`. Set `VITE_OIDC_TOKEN_TYPE=id_token` when the
 * IdP's access token is opaque (common with Google) and UserApi must validate
 * a JWT via the tenant OIDC JWKS config.
 */
export async function getAccessToken(): Promise<string> {
  let user = await userManager.getUser();

  if (!user || user.expired) {
    try {
      user = await userManager.signinSilent();
    } catch {
      await userManager.signinRedirect();
      throw new Error('Authentication required — redirecting to login');
    }
  }

  const token =
    tokenType === 'id_token' ? user?.id_token : user?.access_token;

  if (!token) {
    throw new Error(`No ${tokenType} available from OIDC user session`);
  }

  persistJwtForDevProxy(token);
  return token;
}

export async function getCurrentUser(): Promise<User | null> {
  return userManager.getUser();
}

export function login(): Promise<void> {
  return userManager.signinRedirect();
}

export function logout(): Promise<void> {
  clearJwtDevProxyCookie();
  return userManager.signoutRedirect();
}

/**
 * Finish an OIDC redirect/silent/popup callback based on stored request_type.
 * Prefer this over signinRedirectCallback when redirect_uri may also be used
 * for silent renew.
 */
export async function completeLogin(): Promise<User | void> {
  const result = await userManager.signinCallback();
  if (result) {
    const token =
      tokenType === 'id_token' ? result.id_token : result.access_token;
    if (token) {
      persistJwtForDevProxy(token);
    }
  }
  return result;
}

export async function completeSilentRenew(): Promise<void> {
  await userManager.signinSilentCallback();
}

/** Drop ?code&state from the address bar after a successful same-page callback. */
export function clearOidcCallbackUrl(): void {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  window.history.replaceState({}, document.title, url.pathname);
}

function claimString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function emailLike(value: unknown): string | null {
  const s = claimString(value);
  return s && s.includes('@') ? s : null;
}

/** Decode a JWT payload without verifying (browser already trusts IdP via OIDC). */
function decodeJwtPayload(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const EMAIL_CLAIM_KEYS = [
  'email',
  'emails',
  'mail',
  'preferred_username',
  'upn',
  'unique_name',
  'signInName',
  'verified_primary_email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
];

function findEmailInClaims(claims: Record<string, unknown> | null | undefined): string | null {
  if (!claims) return null;

  for (const key of EMAIL_CLAIM_KEYS) {
    const value = claims[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const nested =
            emailLike((item as Record<string, unknown>).value) ||
            emailLike((item as Record<string, unknown>).email);
          if (nested) return nested;
        }
        const direct = emailLike(item);
        if (direct) return direct;
      }
      continue;
    }
    const direct = emailLike(value);
    if (direct) return direct;
  }

  // Last resort: any string claim that looks like an email (custom B2C outputs).
  for (const value of Object.values(claims)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = emailLike(item);
        if (found) return found;
      }
    } else {
      const found = emailLike(value);
      if (found) return found;
    }
  }

  return null;
}

/** Merge profile + raw id/access token payloads for claim lookup. */
function allUserClaims(user: User): Record<string, unknown> {
  return {
    ...(decodeJwtPayload(user.id_token) ?? {}),
    ...(decodeJwtPayload(user.access_token) ?? {}),
    ...(user.profile as Record<string, unknown>),
  };
}

/** Prefer email-like claims, then sub — used as UserApi participantId. */
export function participantIdFromUser(user: User | null): string {
  if (!user) return '';

  const claims = allUserClaims(user);
  const email = findEmailInClaims(claims);
  if (email) return email;

  const sub = claimString(claims.sub);
  if (sub) {
    console.warn(
      '[oidc-jwt] No email claim in ID/access token; falling back to sub for participantId.',
      'Token claim keys:',
      Object.keys(claims).sort(),
    );
  }
  return sub ?? '';
}

export function formatUserLabel(user: User | null): string {
  if (!user) return 'Not signed in';
  const participant = participantIdFromUser(user);
  const profile = user.profile;
  const nameClaim = typeof profile.name === 'string' ? profile.name.trim() : '';
  // Prefer email/participant over a non-email display name (Azure often uses object id-ish values).
  const label =
    (participant.includes('@') ? participant : null) ||
    (nameClaim.includes('@') ? nameClaim : null) ||
    nameClaim ||
    participant ||
    'signed in';
  const exp = user.expires_at
    ? new Date(user.expires_at * 1000).toLocaleTimeString()
    : '?';
  return `${label} · token exp ${exp}`;
}
