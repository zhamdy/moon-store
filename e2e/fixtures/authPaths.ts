import path from 'node:path';

/**
 * Session state lives outside `outputDir` on purpose: it holds a real access token and
 * the httpOnly refresh cookie, and anything under `outputDir` is swept into the CI
 * failure artifacts, which are downloadable by anyone on a public repository.
 */
const AUTH_DIR = path.join(__dirname, '..', 'playwright', '.auth');

export const adminStatePath = path.join(AUTH_DIR, 'admin.json');
export const cashierStatePath = path.join(AUTH_DIR, 'cashier.json');
export { AUTH_DIR };
