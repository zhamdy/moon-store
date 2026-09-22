import { describe, expect, it } from 'vitest';
import { editorialSlots } from '@/lib/editorial/slots';
import { promoBanner } from './promo-banner';

describe('promoBanner data', () => {
  it('names registered editorial slots for both crops', () => {
    const known = new Set<string>(editorialSlots);
    expect(known.has(promoBanner.wide)).toBe(true);
    expect(known.has(promoBanner.portrait)).toBe(true);
  });

  // One 16:9 source serving both crops is deliberate, but then the phone crop is
  // decided entirely by object-position: without one the model falls out of frame.
  it('carries an explicit portrait object-position when both crops share a slot', () => {
    if (promoBanner.wide !== promoBanner.portrait) return;
    expect(promoBanner.portraitImageClassName).toMatch(/^object-\[/);
  });

  it('has a locale-less absolute href', () => {
    expect(promoBanner.href.startsWith('/')).toBe(true);
    expect(promoBanner.href.startsWith('/en')).toBe(false);
    expect(promoBanner.href.startsWith('/ar')).toBe(false);
  });
});
