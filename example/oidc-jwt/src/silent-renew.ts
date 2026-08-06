import { completeSilentRenew } from './auth';

/**
 * Hidden iframe target for oidc-client-ts silent token renewal.
 */
completeSilentRenew().catch((err) => {
  console.error('Silent renew failed', err);
});
