# XiansAi SDK — Examples

Runnable browser apps that import the SDK from the parent package source so you
can hack on the library and see changes immediately.

| Example | Auth | Port | What it demos |
|---------|------|------|----------------|
| [`api-key-chat/`](./api-key-chat/) | API key (`apikey` query param) | 5173 | REST send + SSE listen |
| [`oidc-jwt/`](./oidc-jwt/) | OIDC → JWT Bearer via `getJwtToken` | 5174 | Same chat flow; IdP + Tenant Settings OIDC block |

Both talk to the XiansAi **UserApi** (not WebApi). Vite proxies `/api/*` to
`VITE_SERVER_URL` so the browser stays same-origin and avoids CORS.

## Which one should I run?

- **API key** — simplest path for server-style or local agent testing. No IdP.
- **OIDC / JWT** — user-context auth for web apps. Requires an OIDC provider
  (Google, Auth0, etc.) and a tenant OIDC config saved in **Agent Studio →
  Tenant Settings** (Admin API).

## Quick start

```bash
# API key chat
cd example/api-key-chat
cp .env.example .env   # set VITE_SERVER_URL, VITE_API_KEY, …
npm install && npm run dev

# OIDC JWT chat (separate terminal / port)
cd example/oidc-jwt
cp .env.example .env   # set OIDC + server vars
npm install && npm run dev
```

See each example’s README for full setup (workflow identifiers, IdP redirect
URIs, and the Agent Studio OIDC block).
