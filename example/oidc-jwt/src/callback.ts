import { completeLogin } from './auth';

/**
 * Dedicated OIDC callback page (e.g. `/callback` or `/callback.html`).
 * Dispatches via signinCallback() so redirect vs silent is taken from stored state.
 */
async function main() {
  const status = document.getElementById('status');
  const isSilentFrame = window.self !== window.top;

  try {
    await completeLogin();
    if (isSilentFrame) return;
    if (status) status.textContent = 'Signed in — redirecting…';
    window.location.replace('/');
  } catch (err) {
    console.error(err);
    if (!isSilentFrame && status) {
      status.textContent = `Login failed: ${(err as Error).message}`;
    }
  }
}

main();
