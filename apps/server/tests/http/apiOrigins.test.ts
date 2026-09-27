import { describe, expect, it } from 'vitest';
import { isAllowedApiOrigin } from '../../src/app';

describe('isAllowedApiOrigin', () => {
  const allowed = ['https://moon-store-five.vercel.app', 'https://moon-store-72q.pages.dev'];

  it('admits a listed origin', () => {
    expect(isAllowedApiOrigin('https://moon-store-five.vercel.app', allowed)).toBe(true);
    expect(isAllowedApiOrigin('https://moon-store-72q.pages.dev', allowed)).toBe(true);
  });

  it('refuses an unlisted *.vercel.app origin even when a Vercel origin is listed', () => {
    expect(isAllowedApiOrigin('https://evil-attacker.vercel.app', allowed)).toBe(false);
    expect(isAllowedApiOrigin('https://moon-store-git-x-team.vercel.app', allowed)).toBe(false);
  });

  it('refuses near-misses of a listed origin', () => {
    expect(isAllowedApiOrigin('http://moon-store-five.vercel.app', allowed)).toBe(false);
    expect(isAllowedApiOrigin('https://moon-store-five.vercel.app.evil.com', allowed)).toBe(false);
  });

  it('has nothing to decide for a request without an Origin', () => {
    expect(isAllowedApiOrigin(undefined, allowed)).toBe(true);
  });
});
