import { describe, expect, it } from 'vitest';
import { editorialSlots } from '@/lib/editorial/slots';
import { promoBanner } from './promo-banner';

describe('promoBanner data', () => {
  it('references two distinct editorial slots', () => {
    const known = new Set<string>(editorialSlots);
    expect(known.has(promoBanner.wide)).toBe(true);
    expect(known.has(promoBanner.portrait)).toBe(true);
    expect(promoBanner.wide).not.toBe(promoBanner.portrait);
  });

  it('has a locale-less absolute href', () => {
    expect(promoBanner.href.startsWith('/')).toBe(true);
    expect(promoBanner.href.startsWith('/en')).toBe(false);
    expect(promoBanner.href.startsWith('/ar')).toBe(false);
  });
});
