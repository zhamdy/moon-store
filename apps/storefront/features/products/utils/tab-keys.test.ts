import { describe, expect, it } from 'vitest';
import { tabKeyTarget } from './tab-keys';

describe('tabKeyTarget (horizontal)', () => {
  it('reads Right as next in LTR, wrapping at both ends', () => {
    expect(tabKeyTarget('ArrowRight', 0, 3, 'ltr', 'horizontal')).toBe(1);
    expect(tabKeyTarget('ArrowRight', 2, 3, 'ltr', 'horizontal')).toBe(0);
    expect(tabKeyTarget('ArrowLeft', 0, 3, 'ltr', 'horizontal')).toBe(2);
  });

  it('inverts the arrows in RTL', () => {
    expect(tabKeyTarget('ArrowLeft', 0, 3, 'rtl', 'horizontal')).toBe(1);
    expect(tabKeyTarget('ArrowRight', 0, 3, 'rtl', 'horizontal')).toBe(2);
  });

  it('ignores Up and Down', () => {
    expect(tabKeyTarget('ArrowDown', 0, 3, 'ltr', 'horizontal')).toBeNull();
    expect(tabKeyTarget('ArrowUp', 1, 3, 'rtl', 'horizontal')).toBeNull();
  });

  it('jumps with Home and End and leaves other keys alone', () => {
    expect(tabKeyTarget('Home', 2, 3, 'ltr', 'horizontal')).toBe(0);
    expect(tabKeyTarget('End', 0, 3, 'rtl', 'horizontal')).toBe(2);
    expect(tabKeyTarget('Enter', 0, 3, 'ltr', 'horizontal')).toBeNull();
    expect(tabKeyTarget('Home', 0, 0, 'ltr', 'horizontal')).toBeNull();
  });
});

describe('tabKeyTarget (vertical)', () => {
  it('takes Down and Up as well as the reading arrows', () => {
    expect(tabKeyTarget('ArrowDown', 3, 4, 'ltr', 'vertical')).toBe(0);
    expect(tabKeyTarget('ArrowUp', 0, 4, 'ltr', 'vertical')).toBe(3);
    expect(tabKeyTarget('ArrowLeft', 1, 4, 'rtl', 'vertical')).toBe(2);
  });
});
