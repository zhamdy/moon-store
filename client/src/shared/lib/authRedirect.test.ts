import { describe, it, expect } from 'vitest';
import { getDefaultRoute, safeRedirectTarget } from './authRedirect';

describe('getDefaultRoute', () => {
  it.each([
    ['Admin', '/'],
    ['Cashier', '/pos'],
    ['Delivery', '/deliveries'],
  ])('sends a %s to %s', (role, route) => {
    expect(getDefaultRoute({ role })).toBe(route);
  });

  it('sends an unknown or absent user back to login', () => {
    expect(getDefaultRoute(null)).toBe('/login');
    expect(getDefaultRoute({ role: 'Auditor' })).toBe('/login');
  });
});

describe('safeRedirectTarget', () => {
  it('keeps an in-app path, including its search and hash', () => {
    expect(safeRedirectTarget('/inventory')).toBe('/inventory');
    expect(safeRedirectTarget('/sales?page=3')).toBe('/sales?page=3');
    expect(safeRedirectTarget('/pos#cart')).toBe('/pos#cart');
  });

  it('rejects an absolute URL to another origin', () => {
    expect(safeRedirectTarget('https://evil.example/steal')).toBeUndefined();
    expect(safeRedirectTarget('http://evil.example')).toBeUndefined();
    expect(safeRedirectTarget('javascript:alert(1)')).toBeUndefined();
  });

  it('rejects a protocol-relative path that only looks internal', () => {
    expect(safeRedirectTarget('//evil.example/steal')).toBeUndefined();
    // Browsers normalise the backslash form the same way.
    expect(safeRedirectTarget('/\\evil.example')).toBeUndefined();
  });

  it('rejects login itself, which would loop', () => {
    expect(safeRedirectTarget('/login')).toBeUndefined();
    expect(safeRedirectTarget('/login?redirect=/pos')).toBeUndefined();
    expect(safeRedirectTarget('/login#x')).toBeUndefined();
  });

  it('rejects anything that is not a string', () => {
    expect(safeRedirectTarget(undefined)).toBeUndefined();
    expect(safeRedirectTarget(null)).toBeUndefined();
    expect(safeRedirectTarget(['/pos'])).toBeUndefined();
    expect(safeRedirectTarget(7)).toBeUndefined();
  });

  it('does not treat a path that merely starts with the word login as the login page', () => {
    expect(safeRedirectTarget('/login-history')).toBe('/login-history');
  });
});
