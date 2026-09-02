import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The composition root's auth-failure path. Driven through the transport's
 * auth port -- the same call `client.ts` makes when a token refresh fails --
 * rather than by reaching into session.ts, so the wiring itself is what is
 * under test.
 */
// Declared through vi.hoisted so the factory below -- which vitest hoists
// above every import -- can see them.
const { navigate, invalidate, location } = vi.hoisted(() => ({
  navigate: vi.fn(),
  invalidate: vi.fn(),
  location: { href: '/inventory?page=2' },
}));

vi.mock('../router', () => ({
  router: {
    get state() {
      return { location };
    },
    navigate,
    invalidate,
  },
}));

// Imported for its side effect: installing the auth port and the logout
// teardown. Must come after the router mock.
import '../session';
import { onAuthFailure } from '../../shared/lib/transport/authPort';
import { useAuthStore } from '../../features/auth';

beforeEach(() => {
  vi.clearAllMocks();
  location.href = '/inventory?page=2';
  useAuthStore.setState({
    user: { id: 1, name: 'Sarah', email: 'sarah@moon.com', role: 'Cashier' },
    accessToken: 'stale',
    isAuthenticated: true,
  });
});

describe('a refresh that could not be recovered', () => {
  it('ends the session', () => {
    onAuthFailure();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('carries where the user was, so signing in returns them to it', () => {
    onAuthFailure();

    expect(navigate).toHaveBeenCalledWith({
      to: '/login',
      search: { redirect: '/inventory?page=2' },
    });
  });

  it('carries no redirect when the user was already on the login screen', () => {
    location.href = '/login';

    onAuthFailure();

    expect(navigate).toHaveBeenCalledWith({ to: '/login', search: {} });
  });

  it('never carries a target pointing off this origin', () => {
    location.href = '//evil.example/steal';

    onAuthFailure();

    expect(navigate).toHaveBeenCalledWith({ to: '/login', search: {} });
  });
});
