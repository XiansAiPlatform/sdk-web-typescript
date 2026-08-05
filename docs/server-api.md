# Server API Usage

This SDK talks to the XiansAi server **UserApi** surface — not WebApi (`/api/client/*`), AgentApi (`/api/agent/*`), or AdminApi.

`serverUrl` must be the base URL of a server process that exposes UserApi (combined `--all`, or a dedicated `--user` service).

## UserApi vs WebApi

| Surface | Typical paths | Used by this SDK? |
|---------|---------------|-------------------|
| **UserApi** | `/api/user/*`, `/ws/chat` | **Yes** |
| **WebApi** | `/api/client/*` | No (Agent Studio / control-plane clients) |
| **AgentApi** | `/api/agent/*` | No (agent runtime) |

UserApi is the user-facing messaging API: REST send/converse/history, SSE event streams, SignalR chat hubs, and inbound webhooks. WebApi is the Studio/control-plane API and is out of scope for this package.

## Endpoint map

Paths below are relative to `serverUrl`. The SDK builds them for you; this page documents what is called under the hood.

### REST (`RestSDK`)

| SDK method | HTTP | Path |
|------------|------|------|
| `send` | `POST` | `/api/user/rest/send` |
| `converse` | `POST` | `/api/user/rest/converse` |
| `getHistory` | `GET` | `/api/user/rest/history` |

Common query parameters (always include `tenantId`; auth as below):

- `workflow`, `participantId`
- `type` — for `send` / `converse` (`Chat`, `Data`, `Handoff`)
- `text`, `requestId` — optional on send/converse
- `timeoutSeconds` — optional on converse
- `page`, `pageSize`, `scope` — optional on history

Request body is JSON for message payload (`data`, etc.).

**Server also exposes** `DELETE /api/user/rest/thread` (delete conversation thread). The public `RestSDK` does not wrap this today; use `SocketSDK.deleteThread` or call the HTTP endpoint directly if needed.

### SSE (`SseSDK`)

| SDK method | HTTP | Path |
|------------|------|------|
| `connect` | `GET` (EventSource) | `/api/user/sse/events` |

Query parameters:

- Required: `workflow`, `participantId`, `tenantId`
- Optional: `scope`, `heartbeatSeconds` (server clamps to 1–300)

### WebSocket / SignalR (`SocketSDK`)

| SDK concern | Transport | Path |
|-------------|-----------|------|
| Connection | SignalR hub | `/ws/chat` |

Hub methods invoked by the SDK:

| SDK method | Hub method |
|------------|------------|
| `sendInboundMessage` | `SendInboundMessage` |
| `getThreadHistory` | `GetThreadHistory` or `GetScopedThreadHistory` |
| `deleteThread` | `DeleteThread` |
| `subscribeToAgent` | `SubscribeToAgent` |
| `unsubscribeFromAgent` | `UnsubscribeFromAgent` |

Server events the SDK listens for include `ReceiveMessage`, `ReceiveMetadata`, `ThreadHistory`, and connection lifecycle callbacks.

**Server also exposes** `/ws/tenant/chat` (`TenantChatHub`). This SDK connects only to `/ws/chat`.

### AgentSDK

`AgentSDK` is a higher-level facade over the same UserApi SignalR hub. It expects a fully qualified `agentWebsocketUrl` (typically `{serverUrl}/ws/chat`) plus tenant and auth settings, rather than composing paths from `serverUrl` like `RestSDK` / `SocketSDK` / `SseSDK`.

### Not used by this SDK

UserApi also maps webhook endpoints (for example `/api/user/webhooks/*`). Those are for server-to-server inbound webhooks, not for the TypeScript client SDKs in this package.

## Authentication against UserApi

All three public SDKs authenticate with the UserApi handlers (`EndpointAuthenticationHandler` for HTTP/SSE, `WebsocketAuthenticationHandler` for SignalR).

| Method | How it is sent |
|--------|----------------|
| API key | Query parameter `apikey` |
| JWT | `Authorization: Bearer <token>` (SSE may fall back to `access_token` query param in browsers that cannot set EventSource headers) |
| Tenant | Query parameter `tenantId` on every request/connection |

See [Authentication](./authentication.md) for setup patterns and security guidance.

## Example URLs

With `serverUrl = https://api.yourdomain.com`:

```text
POST https://api.yourdomain.com/api/user/rest/send?tenantId=...&apikey=...&workflow=...&type=Chat&participantId=...
POST https://api.yourdomain.com/api/user/rest/converse?tenantId=...&apikey=...&workflow=...&type=Chat&participantId=...
GET  https://api.yourdomain.com/api/user/rest/history?tenantId=...&apikey=...&workflow=...&participantId=...
GET  https://api.yourdomain.com/api/user/sse/events?tenantId=...&apikey=...&workflow=...&participantId=...
     wss://api.yourdomain.com/ws/chat?tenantId=...&apikey=...
```

## Related docs

- [Overview](./overview.md) — architecture and when to use each SDK
- [Authentication](./authentication.md) — API key vs JWT details
- [REST SDK](./rest-sdk.md) · [Socket SDK](./socket-sdk.md) · [SSE SDK](./sse-sdk.md)
