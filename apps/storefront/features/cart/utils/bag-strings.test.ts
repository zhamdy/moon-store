import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import { PLURAL_KEYS } from './bag-strings';

const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

function at(root: unknown, dotted: string): unknown {
  return dotted
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      root
    );
}

describe('bag plural families', () => {
  it.each(
    PLURAL_KEYS.flatMap(
      (key) =>
        [
          ['en', key, en],
          ['ar', key, ar],
        ] as const
    )
  )('%s bag.%s is an object of six non-empty templates', (_locale, key, messages) => {
    const family = at(messages, `bag.${key}`);
    expect(family).toBeTypeOf('object');
    const record = family as Record<string, unknown>;
    for (const category of CATEGORIES) {
      expect(record[category]).toBeTypeOf('string');
      expect((record[category] as string).length).toBeGreaterThan(0);
    }
  });
});
