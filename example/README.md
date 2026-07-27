# XiansAi SDK — Basic Chat Example

A minimal browser chat interface that talks to a XiansAi agent using the SDK:

- **Send** messages with the **REST SDK** (`restSDK.send`)
- **Listen** for agent replies over the **SSE SDK** (`onReceiveChat`)

It's a single-page [Vite](https://vitejs.dev/) app that imports the SDK directly
from the source files in the parent directory, so you can hack on the SDK and see
changes immediately.

## Run it

```bash
cd example
npm install
npm run dev
```

Then open the URL Vite prints (defaults to http://localhost:5173).

## Configure

Copy the env file and set at least the server URL:

```bash
cp .env.example .env
# edit .env
```

| Variable               | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `VITE_SERVER_URL`      | Real XiansAi server. Vite proxies `/api/*` here.       |
| `VITE_TENANT_ID`       | Your tenant identifier                                 |
| `VITE_API_KEY`         | API key used for both REST and SSE auth                |
| `VITE_WORKFLOW`        | Workflow / agent type to converse with                 |
| `VITE_PARTICIPANT_ID`  | Identifier for the end user (e.g. `user-123`)           |

Tenant / API key / workflow / participant can also be typed in the UI and are
saved to `localStorage`. The **server URL is configured only via `.env`**
because it's used to set up the dev proxy when Vite starts.

> **macOS note:** port `5000` is used by AirPlay Receiver, so the server usually
> runs on **`5005`**. Point `VITE_SERVER_URL` at wherever your server actually
> listens (check your `dotnet run` output).

### The workflow identifier

`VITE_WORKFLOW` (the `workflow` param) identifies the agent workflow to talk to.
Copy it verbatim from your agent deployment (XiansAi portal or the agent's
startup logs) — it's not a slug you invent. The server accepts **two formats**,
and which one you must use depends on the number of `:` separators:

| Format                                             | When to use                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `Agent Name:Flow Name`                             | A **workflow type** (0–1 colon). Resolved against your authenticated tenant. |
| `<tenant>:Agent Name:Flow Name[:Run Suffix]`       | A **fully-qualified workflow id** (2+ colons). **Must** start with your tenant id. |

> ⚠️ **The tenant prefix is required once the identifier has 2+ colons.** The
> server reads the first segment of a multi-colon identifier as the tenant id.
> Because the example workflow has a run suffix (`Echo Agent - Ugly Pelican`), it
> has three colons and therefore must be fully qualified:

```dotenv
# ✅ works — fully-qualified, tenant-prefixed (matches VITE_TENANT_ID=default)
VITE_WORKFLOW=default:Echo Agent:Supervisor Workflow:Echo Agent - Ugly Pelican

# ❌ HTTP 400 "Invalid workflow identifier" — 3 colons but no tenant prefix
VITE_WORKFLOW=Echo Agent:Supervisor Workflow:Echo Agent - Ugly Pelican

# ✅ also works — the bare workflow *type* (no run suffix, resolved to your tenant)
VITE_WORKFLOW=Echo Agent:Supervisor Workflow
```

Key points:

- **Match the prefix to `VITE_TENANT_ID`.** The tenant segment must equal the
  tenant you're authenticated as (e.g. `default`).
- **Pass it raw — do not URL-encode it yourself.** The SDK sends `workflow` as a
  query parameter and encodes it internally (via `URLSearchParams`), so spaces
  and `:` are handled for you. In `.env`, don't wrap it in quotes.
- **Use the same value for sending and listening.** This example feeds the one
  `workflow` value into both `restSDK.send({ workflow, ... })` and
  `sseSDK.connect({ workflow, ... })` so your message and the agent's reply are
  paired to the same workflow + `participantId`.

### Why a proxy?

The browser blocks cross-origin requests unless the server sends CORS headers,
which the XiansAi server does not for arbitrary origins. Instead of fighting
CORS, the app makes **same-origin** requests to the Vite dev server, which
forwards `/api/*` to `VITE_SERVER_URL` (see [`vite.config.ts`](./vite.config.ts)).
Both the REST `POST` and the SSE stream go through this proxy.

## How it works

```text
   ┌──────────┐   send (HTTP POST)    ┌──────────────┐
   │  Browser │ ────────────────────▶ │ XiansAi      │
   │  (this   │                       │ Server /     │
   │  example)│ ◀──────────────────── │ Agent        │
   └──────────┘   SSE stream (events) └──────────────┘
```

1. On **Connect**, the app opens an SSE stream scoped to your `workflow` +
   `participantId` and starts listening for `Chat` events.
2. When you send a message, it's POSTed via `restSDK.send(...)` (fire‑and‑forget).
3. The agent's reply comes back asynchronously over the SSE stream and is
   rendered in the chat.

See [`src/main.ts`](./src/main.ts) for the full flow — it's intentionally kept in
one file and heavily commented.
