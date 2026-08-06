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
  env.VITE_OIDC_REDIRECT_URI?.trim() || `${window.location.origin}/callback.html`;
const silentRedirectUri =
  env.VITE_OIDC_SILENT_REDIRECT_URI?.trim() ||
  `${window.location.origin}/silent-renew.html`;
const postLogoutRedirectUri =
  env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI?.trim() || `${window.location.origin}/`;
const scope = env.VITE_OIDC_SCOPE?.trim() || 'openid profile email';
const audience = env.VITE_OIDC_AUDIENCE?.trim();
const tokenType =
  env.VITE_OIDC_TOKEN_TYPE?.trim().toLowerCase() === 'id_token'
    ? 'id_token'
    : 'access_token';

export const userManager = new UserManager({
  authority,
  client_id: clientId,
  ...(clientSecret ? { client_secret: clientSecret } : {}),
  redirect_uri: redirectUri,
  silent_redirect_uri: silentRedirectUri,
  post_logout_redirect_uri: postLogoutRedirectUri,
  response_type: 'code',
  scope,
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  ...(audience
    ? { extraQueryParams: { audience } }
    : {}),
});

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

export async function completeLogin(): Promise<User> {
  const user = await userManager.signinRedirectCallback();
  const token =
    tokenType === 'id_token' ? user.id_token : user.access_token;
  if (token) {
    persistJwtForDevProxy(token);
  }
  return user;
}

export async function completeSilentRenew(): Promise<void> {
  await userManager.signinSilentCallback();
}

/** Prefer email, then sub — used as UserApi participantId. */
export function participantIdFromUser(user: User | null): string {
  if (!user) return '';
  const profile = user.profile;
  if (typeof profile.email === 'string' && profile.email.trim()) {
    return profile.email.trim();
  }
  if (typeof profile.sub === 'string' && profile.sub.trim()) {
    return profile.sub.trim();
  }
  return '';
}

export function formatUserLabel(user: User | null): string {
  if (!user) return 'Not signed in';
  const profile = user.profile;
  const name =
    (typeof profile.name === 'string' && profile.name) ||
    (typeof profile.email === 'string' && profile.email) ||
    (typeof profile.sub === 'string' && profile.sub) ||
    'signed in';
  const exp = user.expires_at
    ? new Date(user.expires_at * 1000).toLocaleTimeString()
    : '?';
  return `${name} · token exp ${exp}`;
}
