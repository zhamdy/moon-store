import { describe, expect, it } from 'vitest';
import en from './en.json';
import ar from './ar.json';

function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) {
    return [prefix];
  }
  return Object.entries(obj).flatMap(([key, value]) =>
    collectKeyPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

function collectStringValues(obj: unknown): string[] {
  if (typeof obj === 'string') {
    return [obj];
  }
  if (typeof obj !== 'object' || obj === null) {
    return [];
  }
  return Object.values(obj).flatMap(collectStringValues);
}

describe('message catalogues', () => {
  it('have identical nested key sets across locales', () => {
    const enKeys = collectKeyPaths(en).sort();
    const arKeys = collectKeyPaths(ar).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it('have no empty string values', () => {
    for (const [locale, catalogue] of [
      ['en', en],
      ['ar', ar],
    ] as const) {
      for (const value of collectStringValues(catalogue)) {
        expect(value.trim(), `empty value in ${locale}`).not.toBe('');
      }
    }
  });
});
