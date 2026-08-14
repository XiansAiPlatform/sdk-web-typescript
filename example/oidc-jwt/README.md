# XiansAi SDK — OIDC / JWT Chat Example

Browser chat that authenticates with an **OIDC provider**, then talks to a
XiansAi agent over **UserApi** using a JWT (`Authorization: Bearer`) — not an
API key.

- **Send** with `RestSDK.send` + `getJwtToken`
- **Listen** with `SseSDK` + the same `getJwtToken`
- **Login** via [`oidc-client-ts`](https://github.com/authts/oidc-client-ts)
  (authorization code + PKCE)

For the API-key variant, see [`../api-key-chat/`](../api-key-chat/).

## Prerequisites

1. A running XiansAi server that exposes **UserApi**
2. An OIDC client with redirect URIs for this app
3. Tenant **OIDC config** in **Agent Studio → Tenant Settings**

For a full Google walkthrough (Cloud Console → `.env` → Studio JSON → test),
see [End-to-end: Google as the auth provider](#end-to-end-google-as-the-auth-provider).

## Run it

```bash
cd example/oidc-jwt
cp .env.example .env
# edit .env — OIDC + VITE_SERVER_URL / tenant / workflow
npm install
npm run dev
```

Vite serves on **http://localhost:3000**.

## Configure

| Variable | Description |
|----------|-------------|
| `VITE_SERVER_URL` | Real XiansAi server. Vite proxies `/api/*` here. |
| `VITE_TENANT_ID` | Tenant identifier (must match Studio / OIDC tenant) |
| `VITE_WORKFLOW` | Workflow / agent type (same rules as api-key-chat) |
| `VITE_OIDC_AUTHORITY` | IdP issuer URL |
| `VITE_OIDC_CLIENT_ID` | OAuth client id |
| `VITE_OIDC_CLIENT_SECRET` | Required for **Google Web** clients; leave empty for public SPAs (Auth0) |
| `VITE_OIDC_REDIRECT_URI` | e.g. `http://localhost:3000/callback.html` |
| `VITE_OIDC_SILENT_REDIRECT_URI` | e.g. `http://localhost:3000/silent-renew.html` |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | e.g. `http://localhost:3000/` |
| `VITE_OIDC_SCOPE` | Default `openid profile email` |
| `VITE_OIDC_TOKEN_TYPE` | `access_token` (default) or `id_token` |
| `VITE_OIDC_AUDIENCE` | Optional; some IdPs need an audience query param |

**Participant ID** is the signed-in user's identity from the OIDC provider
(email when available, otherwise `sub`). The app fills it after sign-in; you
can override it in the UI if needed.

Tenant / workflow can also be edited in the UI (saved to `localStorage`). The
**server URL** and **OIDC** settings are `.env` only.

> **macOS note:** port `5000` is used by AirPlay Receiver, so the server usually
> runs on **`5005`**. Point `VITE_SERVER_URL` at your actual `dotnet run` port.

### Token type (`VITE_OIDC_TOKEN_TYPE`)

UserApi expects a **JWT** it can validate against the tenant OIDC config.

| IdP | Typical choice |
|-----|----------------|
| Auth0 / Keycloak / most OIDC servers that mint JWT access tokens | `access_token` |
| **Google** | `id_token` — Google access tokens are usually opaque, not JWTs |

`.env.example` defaults to `id_token` for an easy Google trial. Switch to
`access_token` when your IdP issues JWT access tokens that match the tenant
OIDC audience/issuer settings.

## End-to-end: Google as the auth provider

Follow these steps once. After that, `npm run dev` → **Sign in** → **Connect**.

Server background (JWT validation concepts): see the Xians server doc
[`GENERIC_OIDC.md`](../../../XiansAi.Server/XiansAi.Server.Src/docs/webapi/GENERIC_OIDC.md)
(Authority / Issuer / Audience / algorithms). That file describes the generic
OIDC *validation* model. For **UserApi** chat with this example, you persist the
rules as a **per-tenant OIDC block** (Agent Studio → Tenant Settings → Admin
API), not only in `appsettings.json`.

### 1. Create a Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/) and pick (or
   create) a project.
2. **APIs & Services → OAuth consent screen**
   - User type: **External** (or Internal if you only use a Google Workspace).
   - App name, support email, developer contact — fill the required fields.
   - Scopes: at least `openid`, `.../auth/userinfo.email`,
     `.../auth/userinfo.profile` (or the equivalent “email” / “profile” scopes).
   - Test users: add your Google account while the app is in Testing.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: e.g. `xians-sdk-oidc-jwt-local`
   - **Authorized JavaScript origins**
     - `http://localhost:3000`
   - **Authorized redirect URIs**
     - `http://localhost:3000/callback.html`
     - `http://localhost:3000/silent-renew.html`
4. Create, then copy both:
   - **Client ID** (`….apps.googleusercontent.com`)
   - **Client secret** (`GOCSPX-…`)
   
   Google’s **Web application** clients are confidential: the token endpoint
   returns `client_secret is missing` if you omit the secret, even when the
   app uses PKCE. That is a Google limitation, not an oidc-client-ts bug.

> **Local demo only:** a `VITE_` secret is visible in the browser bundle. Fine
> for trying this example on localhost; do **not** ship a production Google
> secret in a frontend. Production apps should exchange the code on a backend
> (BFF) or use an IdP that supports public SPA clients (e.g. Auth0).

### 2. Fill `.env` for this example

```bash
cd example/oidc-jwt
cp .env.example .env
```

Edit `.env` (replace client id/secret and point at your UserApi):

```dotenv
VITE_SERVER_URL=http://localhost:5005
VITE_TENANT_ID=default
VITE_WORKFLOW=default:Echo Agent:Supervisor Workflow:Echo Agent - Ugly Pelican

VITE_OIDC_AUTHORITY=https://accounts.google.com
VITE_OIDC_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
VITE_OIDC_CLIENT_SECRET=GOCSPX-your-google-client-secret
VITE_OIDC_REDIRECT_URI=http://localhost:3000/callback.html
VITE_OIDC_SILENT_REDIRECT_URI=http://localhost:3000/silent-renew.html
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/
VITE_OIDC_SCOPE=openid profile email

# Google access tokens are usually opaque — send the ID token JWT to UserApi.
VITE_OIDC_TOKEN_TYPE=id_token
```

| Field | Why |
|-------|-----|
| `VITE_OIDC_AUTHORITY` | Google discovery base (`/.well-known/openid-configuration`) |
| `VITE_OIDC_CLIENT_ID` | Same Client ID as the Google OAuth app |
| `VITE_OIDC_CLIENT_SECRET` | Required by Google Web clients at code→token exchange |
| Redirect URIs | Must match Google Console **exactly** (including `/callback.html`) |
| `VITE_OIDC_TOKEN_TYPE=id_token` | Google ID token `aud` = your Client ID; that is what the server validates |

Participant ID is **not** in `.env` — after Sign in it becomes the user’s
Google **email** (else `sub`).

### 3. Save the tenant OIDC block (Agent Studio)

UserApi accepts JWTs only if the **tenant** has matching OIDC rules. This
example does not call the Admin API; you save the block in Studio.

1. Sign in to **Agent Studio** as a tenant admin (or sysadmin).
2. Open **Tenant Settings** for the same tenant as `VITE_TENANT_ID` (e.g.
   `default`).
3. Find the **OIDC configuration** editor (Studio persists via Admin API
   `…/tenants/{tenantId}/oidc-config`).
4. Paste a config like the following (use **your** Google Client ID in
   `expectedAudience`):

```json
{
  "tenantId": "default",
  "allowedProviders": ["google"],
  "providers": {
    "google": {
      "authority": "https://accounts.google.com",
      "issuer": "https://accounts.google.com",
      "expectedAudience": [
        "1234567890-abcdefg.apps.googleusercontent.com"
      ],
      "requireSignedTokens": true,
      "acceptedAlgorithms": ["RS256"],
      "requireHttpsMetadata": true
    }
  },
  "notes": "Local oidc-jwt example — Google ID tokens"
}
```

> **Do not set `scope` for Google ID tokens.** If `providers.google.scope` is
> set (e.g. `"openid profile email"`), the server requires a `scope` or `scp`
> claim on the JWT. Google **ID tokens** do not include that claim (only some
> access tokens do), so validation fails with `Missing scope claim`. Omit
> `scope` (or set it empty) when using `VITE_OIDC_TOKEN_TYPE=id_token`.

5. Save. Studio upserts the encrypted tenant OIDC config. If you previously
   saved a config that included `scope`, edit it and remove that field, then
   save again (cache refreshes shortly).

**Field mapping (Google ID token → server rules)**

| Token / IdP | Tenant OIDC field |
|-------------|-------------------|
| Discovery / JWKS from Google | `authority` → `https://accounts.google.com` |
| ID token `iss` | `issuer` → `https://accounts.google.com` |
| ID token `aud` (= OAuth Client ID) | `expectedAudience` → your Client ID |
| Signing | `acceptedAlgorithms`: `["RS256"]` |
| `scope` / `scp` claim | **Omit** `scope` in the provider rule for Google ID tokens |

Optional: Google Workspace hosted-domain check (only allow `@company.com`):

```json
"additionalClaims": [
  { "claim": "hd", "op": "equals", "value": "company.com" }
]
```

You can also fetch a starter template from the Admin API:

`GET /api/v1/admin/tenants/{tenantId}/oidc-config/template`

Then trim it to a single `google` provider and set `expectedAudience`.

> **Note:** `GENERIC_OIDC.md` also shows a host-level `AuthProvider: Provider =
> "Oidc"` + `Oidc: { … }` block in `appsettings.json`. That mode is for
> **WebAPI** static OIDC. For this SDK example against **UserApi**, the
> **per-tenant** JSON above (Agent Studio) is what `DynamicOidcValidator`
> uses. Keep Authority / Issuer / Audience / algorithms aligned either way.

Until the tenant block is saved (and `expectedAudience` matches the Client ID
in the ID token), UserApi returns **401** on Connect / send.

### 4. Run and test

```bash
npm install
npm run dev
```

1. Open http://localhost:3000  
2. **Sign in** → Google account → return via `/callback.html`  
3. Confirm **Participant ID (from OIDC)** shows your email  
4. Set tenant + workflow if needed → **Connect** → send a chat message  

Other IdPs (Auth0, Keycloak, Microsoft): same pattern — create a public SPA
client, put authority/client/redirects in `.env`, prefer
`VITE_OIDC_TOKEN_TYPE=access_token` when the IdP mints JWT access tokens, and
save a matching `providers.<name>` entry in Tenant Settings.

## How it works

```text
   ┌──────────┐  OIDC login   ┌────────────┐
   │  Browser │ ────────────▶ │ IdP        │
   │  (this   │ ◀── JWT ───── │ (Google…)  │
   │  example)│               └────────────┘
   │          │  Bearer JWT   ┌──────────────┐
   │          │ ────────────▶ │ Xians UserApi│
   │          │ ◀── SSE ───── │ + Agent      │
   └──────────┘               └──────────────┘
```

1. **Sign in** runs `UserManager.signinRedirect()`; `/callback.html` finishes
   the code flow and returns home.
2. On **Connect**, the app builds `RestSDK` / `SseSDK` with
   `getJwtToken: getAccessToken` (no `apiKey`).
3. Send + SSE use the Vite `/api` proxy (same CORS approach as api-key-chat).
   Native EventSource cannot send `Authorization`, so after login the app stores
   the JWT in a same-origin cookie (`xians_oidc_jwt`) and the Vite proxy injects
   `Authorization: Bearer …` when forwarding to UserApi.
4. Silent renew uses `/silent-renew.html` so tokens refresh without a full
   redirect when possible.

See [`src/auth.ts`](./src/auth.ts) and [`src/main.ts`](./src/main.ts).

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| **Login failed: client_secret is missing** | Google Web client needs `VITE_OIDC_CLIENT_SECRET` in `.env` (restart `npm run dev` after editing) |
| Connect / send returns **401** | Tenant OIDC block missing/mismatched (`issuer` / `expectedAudience` = Google Client ID); wrong `VITE_OIDC_TOKEN_TYPE`; wrong `VITE_TENANT_ID` |
| Server log: `JWT validation failed: Missing scope claim` | Remove `scope` from the Google provider in Tenant Settings OIDC JSON (Google ID tokens have no `scope`/`scp` claim) |
| Server log: `No access token found` on SSE | Restart `npm run dev` after Vite proxy changes; Sign in again so the `xians_oidc_jwt` cookie is set; Connect. Browser EventSource cannot send Bearer headers — the proxy injects them from that cookie. |
| Server log: `No tenantId provided in query string` | Usually a follow-on after auth failed (no TenantId claim). Fix the JWT validation error above first. |
| Redirect URI mismatch | IdP console URIs must exactly match `VITE_OIDC_REDIRECT_URI` |
| Google works for login but API fails | Use `VITE_OIDC_TOKEN_TYPE=id_token` and register that client id in Tenant Settings |
| CORS errors | Ensure traffic goes through the Vite proxy (`serverUrl` = `window.location.origin`) |

## Related docs

- [Authentication](../../docs/authentication.md) — API key vs JWT
- [Server API](../../docs/server-api.md) — UserApi paths
- [Authentication examples](../../docs/examples/authentication.md) — OIDC patterns
- [Server GENERIC_OIDC.md](../../../XiansAi.Server/XiansAi.Server.Src/docs/webapi/GENERIC_OIDC.md) — Authority / Issuer / Audience validation model
