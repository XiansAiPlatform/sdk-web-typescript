import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { IncomingMessage } from 'node:http';

// The SSE SDK contains a Node-only `require('eventsource')` fallback that is
// never reached in the browser (native EventSource is used instead). We alias
// it to an empty stub so the browser bundle doesn't try to pull in Node modules.
const eventsourceStub = fileURLToPath(
  new URL('./src/eventsource-stub.ts', import.meta.url)
);

/** Must match JWT_DEV_PROXY_COOKIE in src/auth.ts */
const JWT_DEV_PROXY_COOKIE = 'xians_oidc_jwt';

function cookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return rest.join('=');
      }
    }
  }
  return undefined;
}

/**
 * Native EventSource cannot set Authorization. The SPA stores the OIDC JWT in a
 * same-origin cookie after login; this proxy injects Bearer auth when forwarding
 * to UserApi. Also promotes ?access_token= to the Authorization header.
 */
function attachJwtProxyAuth(): ProxyOptions['configure'] {
  return (proxy) => {
    proxy.on('proxyReq', (proxyReq, req: IncomingMessage) => {
      if (proxyReq.getHeader('Authorization')) {
        return;
      }

      const fromCookie = cookieValue(req.headers.cookie, JWT_DEV_PROXY_COOKIE);
      if (fromCookie) {
        proxyReq.setHeader('Authorization', `Bearer ${fromCookie}`);
        return;
      }

      const url = req.url ?? '';
      const q = url.indexOf('?');
      if (q >= 0) {
        const accessToken = new URLSearchParams(url.slice(q + 1)).get('access_token');
        if (accessToken) {
          proxyReq.setHeader('Authorization', `Bearer ${accessToken}`);
        }
      }
    });
  };
}

/**
 * Serve registered Azure SPA redirect paths from the matching HTML entry.
 * `/callback` → dedicated callback page; `/auth` → the main SPA (login + post-logout).
 */
function rewriteOidcRedirectPath(url: string | undefined): string | undefined {
  if (!url) return url;

  const q = url.indexOf('?');
  const pathname = q >= 0 ? url.slice(0, q) : url;
  const qs = q >= 0 ? url.slice(q) : '';
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/callback') {
    return `/callback.html${qs}`;
  }

  if (path === '/auth') {
    return `/index.html${qs}`;
  }

  return url;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The real XiansAi server to forward API calls to. Defaults to the common
  // local dev port. On macOS, port 5000 is taken by AirPlay Receiver, so the
  // server usually runs on 5005 (see `dotnet run` output).
  const target = env.VITE_SERVER_URL || 'http://localhost:5005';
  const root = fileURLToPath(new URL('.', import.meta.url));

  return {
    root: '.',
    resolve: {
      alias: {
        eventsource: eventsourceStub,
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(root, 'index.html'),
          callback: resolve(root, 'callback.html'),
          silentRenew: resolve(root, 'silent-renew.html'),
        },
      },
    },
    plugins: [
      {
        name: 'oidc-callback-path',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            const rewritten = rewriteOidcRedirectPath(req.url);
            if (rewritten) req.url = rewritten;
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, _res, next) => {
            const rewritten = rewriteOidcRedirectPath(req.url);
            if (rewritten) req.url = rewritten;
            next();
          });
        },
      },
    ],
    server: {
      // Pin host so the browser origin matches Azure redirect URIs (localhost ≠ 127.0.0.1).
      host: 'localhost',
      port: 4200,
      strictPort: true,
      open: true,
      // Proxy API + SSE calls to the real server so the browser only ever makes
      // same-origin requests. This sidesteps CORS entirely (the server does not
      // send Access-Control-Allow-Origin headers for cross-origin callers).
      // JWT: inject Authorization from the SPA cookie (EventSource cannot).
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          configure: attachJwtProxyAuth(),
        },
      },
    },
  };
});
