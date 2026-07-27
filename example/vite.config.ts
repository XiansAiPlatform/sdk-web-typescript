import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

// The SSE SDK contains a Node-only `require('eventsource')` fallback that is
// never reached in the browser (native EventSource is used instead). We alias
// it to an empty stub so the browser bundle doesn't try to pull in Node modules.
const eventsourceStub = fileURLToPath(
  new URL('./src/eventsource-stub.ts', import.meta.url)
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The real XiansAi server to forward API calls to. Defaults to the common
  // local dev port. On macOS, port 5000 is taken by AirPlay Receiver, so the
  // server usually runs on 5005 (see `dotnet run` output).
  const target = env.VITE_SERVER_URL || 'http://localhost:5005';

  return {
    root: '.',
    resolve: {
      alias: {
        eventsource: eventsourceStub,
      },
    },
    server: {
      port: 5173,
      open: true,
      // Proxy API + SSE calls to the real server so the browser only ever makes
      // same-origin requests. This sidesteps CORS entirely (the server does not
      // send Access-Control-Allow-Origin headers for cross-origin callers).
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
