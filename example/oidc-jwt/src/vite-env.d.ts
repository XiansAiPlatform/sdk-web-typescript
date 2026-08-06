/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  readonly VITE_TENANT_ID?: string;
  readonly VITE_WORKFLOW?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  /** Required for Google Web clients; omit for public SPA IdPs (Auth0, etc.). */
  readonly VITE_OIDC_CLIENT_SECRET?: string;
  readonly VITE_OIDC_REDIRECT_URI?: string;
  readonly VITE_OIDC_SILENT_REDIRECT_URI?: string;
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: string;
  readonly VITE_OIDC_SCOPE?: string;
  readonly VITE_OIDC_AUDIENCE?: string;
  /** Which OIDC token to send as the UserApi JWT: `access_token` (default) or `id_token`. */
  readonly VITE_OIDC_TOKEN_TYPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
