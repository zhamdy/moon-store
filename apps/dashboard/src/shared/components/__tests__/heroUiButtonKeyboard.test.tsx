import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@heroui/react';

/**
 * The behaviour behind #111, pinned so nobody has to rediscover it.
 *
 * HeroUI's Button is react-aria based: it intercepts key events and dispatches `onPress`,
 * suppressing the native click. A handler on `onClick` therefore fires for a mouse and
 * never for a keyboard — which left 209 buttons pointer-only with every gate green.
 *
 * The lint rule is what stops a new one landing. This is what stops the lint rule from
 * looking like superstition after someone upgrades HeroUI: if a future version makes
 * `onClick` fire from the keyboard, the first test here fails and the rule can go.
 */
describe('HeroUI Button keyboard activation', () => {
  function pressEnter(name: string) {
    const button = screen.getByRole('button', { name });
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });
  }

  it('does not fire onClick from the keyboard — the reason for the rule', () => {
    const onClick = vi.fn();
    // eslint-disable-next-line no-restricted-syntax -- demonstrating the defect the rule prevents
    render(<Button onClick={onClick}>Legacy</Button>);

    pressEnter('Legacy');
    expect(onClick).not.toHaveBeenCalled();

    // ...while a pointer works, which is exactly why this was invisible.
    fireEvent.click(screen.getByRole('button', { name: 'Legacy' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fires onPress from the keyboard', () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Correct</Button>);

    pressEnter('Correct');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  /*
   * The pointer half is deliberately not asserted here.
   *
   * `usePress` is built on real pointer input, and jsdom reaches none of it: a bare
   * `fireEvent.click` never gets there, and synthesised `pointerDown`/`pointerUp` do not
   * either, because jsdom's PointerEvent support is not what react-aria listens for.
   * Asserting it would mean writing a test that passes for a reason unrelated to the app.
   *
   * A real mouse and Playwright both produce the input react-aria wants, so the pointer
   * path is covered where it can actually be exercised: `e2e/specs`, where every existing
   * `.click()` on these buttons keeps passing.
   */

  it('fires onPress from Space as well, which is the other button key', () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Spacebar</Button>);

    const button = screen.getByRole('button', { name: 'Spacebar' });
    button.focus();
    fireEvent.keyDown(button, { key: ' ', code: 'Space' });
    fireEvent.keyUp(button, { key: ' ', code: 'Space' });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
