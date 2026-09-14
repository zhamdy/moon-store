import { describe, expect, it } from 'vitest';
import {
  hasContactDetails,
  storeContact,
  telHref,
  validateStoreContact,
  type StoreContact,
} from './contact';

const empty: StoreContact = {
  phone: { e164: '', display: '' },
  address: { en: '', ar: '' },
  social: [],
};

describe('storeContact (the shipped config)', () => {
  it('is valid, so the footer never renders a malformed number, address or link', () => {
    expect(validateStoreContact(storeContact)).toEqual([]);
  });
});

describe('telHref', () => {
  it('keeps the leading + and the digits', () => {
    expect(telHref('+20 10 1234 5678')).toBe('tel:+201012345678');
  });

  it('strips dashes, brackets and spaces from a local number', () => {
    expect(telHref('(010) 1234-5678')).toBe('tel:01012345678');
  });
});

describe('hasContactDetails', () => {
  it('is false when nothing is filled in', () => {
    expect(hasContactDetails(empty, 'en')).toBe(false);
  });

  it('is true with only a phone', () => {
    expect(
      hasContactDetails(
        { ...empty, phone: { e164: '+201012345678', display: '+20 10 1234 5678' } },
        'ar'
      )
    ).toBe(true);
  });

  it('is true with only an address in that locale', () => {
    expect(hasContactDetails({ ...empty, address: { en: 'Cairo', ar: 'القاهرة' } }, 'en')).toBe(
      true
    );
  });

  it('ignores whitespace-only values', () => {
    expect(hasContactDetails({ ...empty, address: { en: '  ', ar: '  ' } }, 'en')).toBe(false);
  });
});

describe('validateStoreContact', () => {
  it('accepts an empty config', () => {
    expect(validateStoreContact(empty)).toEqual([]);
  });

  it('accepts a complete config', () => {
    expect(
      validateStoreContact({
        phone: { e164: '+201012345678', display: '+20 10 1234 5678' },
        address: { en: 'Cairo, Egypt', ar: 'القاهرة، مصر' },
        social: [
          { network: 'instagram', url: 'https://www.instagram.com/example' },
          { network: 'whatsapp', url: 'https://wa.me/201012345678' },
        ],
      })
    ).toEqual([]);
  });

  it('rejects a phone that is not in international format', () => {
    expect(
      validateStoreContact({ ...empty, phone: { e164: '01012345678', display: '010 1234 5678' } })
    ).toHaveLength(1);
  });

  it('rejects a display number without the E.164 number, and the reverse', () => {
    expect(validateStoreContact({ ...empty, phone: { e164: '', display: '010' } })).toHaveLength(1);
    expect(
      validateStoreContact({ ...empty, phone: { e164: '+201012345678', display: '' } })
    ).toHaveLength(1);
  });

  it('rejects an address filled in for one locale only', () => {
    expect(validateStoreContact({ ...empty, address: { en: 'Cairo', ar: '' } })).toHaveLength(1);
  });

  it('rejects a non-https social URL and a duplicated network', () => {
    const problems = validateStoreContact({
      ...empty,
      social: [
        { network: 'instagram', url: 'http://instagram.com/example' },
        { network: 'instagram', url: 'https://instagram.com/example' },
      ],
    });
    expect(problems).toHaveLength(2);
  });
});
