import { completeLogin } from './auth';

/**
 * OIDC redirect callback page.
 * Completes the authorization-code flow, then returns to the chat app.
 */
async function main() {
  const status = document.getElementById('status');
  try {
    await completeLogin();
    if (status) status.textContent = 'Signed in — redirecting…';
    window.location.replace('/');
  } catch (err) {
    console.error(err);
    if (status) {
      status.textContent = `Login failed: ${(err as Error).message}`;
    }
  }
}

main();
