import { describe, expect, it } from 'vitest';
import { navPanelAfterKey } from './desktop-nav-state';

describe('navPanelAfterKey', () => {
  it('opens a closed panel', () => {
    expect(navPanelAfterKey(null, 'shop')).toBe('shop');
  });

  it('closes the panel that is open when its own trigger is activated again', () => {
    expect(navPanelAfterKey('shop', 'shop')).toBeNull();
  });

  it('switches to another panel, one at a time', () => {
    expect(navPanelAfterKey('shop', 'collections')).toBe('collections');
  });
});
