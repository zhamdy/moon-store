'use client';

import { useState, type CSSProperties } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NavLink } from '../nav-link';
import { LocaleSwitcher, type LocaleSwitcherProps } from '../locale-switcher';
import type { NavItem } from '../navigation-items';

export interface MobileMenuProps {
  menuLabel: string;
  closeLabel: string;
  primaryLabel: string;
  items: Array<NavItem & { label: string }>;
  localeSwitcher: LocaleSwitcherProps;
}

/** Link entrance stagger, the design system's `stagger` step, applied by CSS, not state. */
const LINK_STAGGER_MS = 70;
const LINK_STAGGER_OFFSET_MS = 120;

/**
 * The mobile menu: a composed Espresso page rather than a drawer of links (design system,
 * 2026-09-25). Numbered serif links, a gold hairline, and the language switch at the foot.
 * Headless UI's Dialog owns the focus trap, Escape and focus restoration. Receives
 * translated strings as props rather than the message catalogue — see
 * apps/storefront/CLAUDE.md.
 *
 * The primary links are set in `type-section-title` (the menu's typography exception,
 * passed through `NavLink`'s `typography` prop) and enter with a CSS stagger: the Dialog
 * mounts its panel on open, so the keyframe simply plays each time. Reduced motion
 * collapses it globally.
 */
export function MobileMenu({
  menuLabel,
  closeLabel,
  primaryLabel,
  items,
  localeSwitcher,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="type-ui flex h-(--size-tap) cursor-pointer items-center gap-2.5 px-2.5"
      >
        {/* Two hairlines, the second shorter: the menu glyph in the system's line weight. */}
        <span aria-hidden="true" className="grid w-[22px] gap-1.5">
          <span className="block h-px bg-current" />
          <span className="block h-px w-3/5 bg-current" />
        </span>
        {menuLabel}
      </button>

      <Dialog open={open} onClose={setOpen} transition className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-overlay transition-opacity duration-base ease-sheet data-closed:opacity-0"
        />

        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            // Espresso: every NavLink inside reads ivory, the accent Champagne, and the
            // focus ring Champagne, through the surface tokens.
            data-surface="ink"
            className="flex h-full w-full flex-col overflow-y-auto bg-bg text-text transition duration-base ease-sheet data-closed:opacity-0 data-closed:-translate-x-4 rtl:data-closed:translate-x-4"
          >
            <DialogTitle className="sr-only">{menuLabel}</DialogTitle>

            <div className="flex h-(--header-h) shrink-0 items-center justify-between px-(--page-gutter)">
              <button
                type="button"
                onClick={close}
                className="type-ui -ms-2.5 flex h-(--size-tap) cursor-pointer items-center gap-2.5 px-2.5"
              >
                <X size={20} strokeWidth={1.5} aria-hidden="true" />
                {closeLabel}
              </button>
              <BrandLogo variant="mark" height={40} className="h-10 w-auto" />
              <span aria-hidden="true" className="w-(--size-tap)" />
            </div>

            <nav
              aria-label={primaryLabel}
              className="flex flex-col gap-1 px-(--page-gutter) pt-10 pb-8"
            >
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className="entrance-fade-up flex items-baseline gap-4"
                  style={
                    {
                      '--entrance-delay': `${LINK_STAGGER_OFFSET_MS + index * LINK_STAGGER_MS}ms`,
                    } as CSSProperties
                  }
                >
                  <span
                    aria-hidden="true"
                    className="w-7 shrink-0 font-display text-base text-brand italic tabular-nums"
                    lang="en"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <NavLink
                    href={item.href}
                    onClick={close}
                    typography="type-section-title"
                    className="py-2"
                  >
                    {item.label}
                  </NavLink>
                </div>
              ))}
            </nav>

            {/* The lower band: one gold hairline, then the language switch. */}
            <div className="mt-auto px-(--page-gutter) pb-8">
              <div className="mb-5 h-px bg-metallic/60" aria-hidden="true" />
              <div className="flex min-h-(--size-tap) items-center">
                <LocaleSwitcher {...localeSwitcher} />
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
