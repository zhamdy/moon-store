import { describe, expect, it } from 'vitest';
import { introDescription } from './intro-heading';

describe('introDescription', () => {
  it('keeps a description that differs from the heading', () => {
    const lead = { text: 'All pieces', lang: 'en' as const };
    expect(introDescription('Shop', lead)).toBe(lead);
  });

  it('drops a description that only repeats the heading, ignoring case and spacing', () => {
    expect(introDescription('Collections', { text: ' collections ', lang: 'en' })).toBeNull();
  });

  it('drops an empty description', () => {
    expect(introDescription('Shop', { text: '  ', lang: 'ar' })).toBeNull();
  });
});
