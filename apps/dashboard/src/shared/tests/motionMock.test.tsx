import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Modal, ModalBody, ModalContent } from '@heroui/react';

/**
 * Guards the `framer-motion` mock in `./setup.ts` against silently going inert.
 *
 * That mock exists to flatten `LazyMotion`, whose async feature load calls `setState`
 * after the test that mounted it has finished — a `window is not defined` unhandled
 * rejection that fails the client job while every test passes (issue #77). But the
 * component mounting `LazyMotion` is HeroUI, not our code, and a dependency vitest loads
 * natively resolves its own imports through node, never seeing vitest's module registry.
 * The mock therefore only reaches HeroUI while `server.deps.inline` in `vitest.config.ts`
 * keeps `@heroui/*` on the transformed path.
 *
 * This test fails — rather than the suite going quietly back to flaking — if that config
 * is removed: `renders` stays at 0 because HeroUI got the real `LazyMotion`.
 */
let renders = 0;

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    LazyMotion: ({ children }: { children: React.ReactNode }) => {
      renders += 1;
      return children;
    },
    m: actual.motion,
  };
});

describe('framer-motion test mock', () => {
  it('replaces the LazyMotion that HeroUI itself renders', () => {
    render(
      <Modal isOpen>
        <ModalContent>
          <ModalBody>content</ModalBody>
        </ModalContent>
      </Modal>
    );

    expect(renders).toBeGreaterThan(0);
  });
});
