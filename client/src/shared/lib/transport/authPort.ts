/**
 * The auth port: the one seam through which the transport layer (below,
 * `shared/`-equivalent) reaches into auth state (above, `features/auth`-
 * equivalent) without importing it directly.
 *
 * `client.ts` needs three operations — read the current token, record a
 * refreshed session, and react to a refresh that failed outright — so this
 * is a small port, not a bare token holder. The default implementation is
 * inert: no token, no-op callbacks. That means a module that imports the
 * transport before `setAuthPort` has run (e.g. a test rendering in
 * isolation) behaves like an unauthenticated client instead of throwing.
 */
import type { AuthUser } from '../../../types/index';

export interface AuthPort {
  getAccessToken: () => string | null;
  onTokenRefreshed: (user: AuthUser, accessToken: string) => void;
  onAuthFailure: () => void;
}

const inertPort: AuthPort = {
  getAccessToken: () => null,
  onTokenRefreshed: () => {},
  onAuthFailure: () => {},
};

let currentPort: AuthPort = inertPort;

/** Installs the real implementation. Called once, at the composition root, before render. */
export function setAuthPort(port: AuthPort): void {
  currentPort = port;
}

export function getAccessToken(): string | null {
  return currentPort.getAccessToken();
}

export function onTokenRefreshed(user: AuthUser, accessToken: string): void {
  currentPort.onTokenRefreshed(user, accessToken);
}

export function onAuthFailure(): void {
  currentPort.onAuthFailure();
}
