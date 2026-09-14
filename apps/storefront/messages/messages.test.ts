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

function collectKeyedStrings(obj: unknown, prefix = ''): Record<string, string> {
  if (typeof obj === 'string') {
    return { [prefix]: obj };
  }
  if (typeof obj !== 'object' || obj === null) {
    return {};
  }
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    Object.assign(acc, collectKeyedStrings(value, prefix ? `${prefix}.${key}` : key));
    return acc;
  }, {});
}

const ICU_PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(value: string): Set<string> {
  return new Set(Array.from(value.matchAll(ICU_PLACEHOLDER), (match) => match[1]));
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

/**
 * Every key present in both `en` and `ar` must use the same ICU placeholder
 * names in both locales. Returns the keys that don't, so a caller can name them.
 */
function placeholderMismatches(en: Record<string, string>, ar: Record<string, string>): string[] {
  return Object.keys(en)
    .filter((key) => key in ar)
    .filter((key) => !sameSet(placeholders(en[key]), placeholders(ar[key])));
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

  it('use identical ICU placeholder names across locales for every shared key', () => {
    const mismatches = placeholderMismatches(collectKeyedStrings(en), collectKeyedStrings(ar));
    expect(mismatches).toEqual([]);
  });
});

describe('placeholderMismatches', () => {
  it('passes when both locales share the same placeholders', () => {
    expect(placeholderMismatches({ a: '{index} of {total}' }, { a: '{index} من {total}' })).toEqual(
      []
    );
  });

  it('fails naming a key when one locale drops a placeholder', () => {
    expect(placeholderMismatches({ a: '{index} of {total}' }, { a: '{index} فقط' })).toEqual(['a']);
  });

  it('passes for a key with no placeholders in either locale', () => {
    expect(placeholderMismatches({ a: 'Hello' }, { a: 'مرحبا' })).toEqual([]);
  });
});
