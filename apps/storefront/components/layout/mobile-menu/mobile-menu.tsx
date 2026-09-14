'use client';

import { useState, type CSSProperties } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { Menu as MenuIcon, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NavLink } from '../nav-link';
import { LocaleSwitcher, type LocaleSwitcherProps } from '../locale-switcher';
import { accountItem, type NavItem } from '../navigation-items';

export interface MobileMenuProps {
  menuLabel: string;
  closeLabel: string;
  primaryLabel: string;
  accountLabel: string;
  items: Array<NavItem & { label: string }>;
  localeSwitcher: LocaleSwitcherProps;
}

/** Link entrance stagger (guideline §13: 60–120ms), applied by CSS, not state. */
const LINK_STAGGER_MS = 70;
const LINK_STAGGER_OFFSET_MS = 120;

/**
 * An editorial full-screen panel on Headless UI's Dialog, which owns the focus
 * trap, Escape and focus restoration. Receives translated strings as props rather
 * than the message catalogue — see apps/storefront/CLAUDE.md.
 *
 * The primary links are set in `type-h2` (the mobile menu typography exception,
 * guideline §5) and enter with a CSS stagger: the Dialog mounts its panel on open,
 * so the keyframe simply plays each time. Reduced motion collapses it globally.
 */
export function MobileMenu({
  menuLabel,
  closeLabel,
  primaryLabel,
  accountLabel,
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
        aria-label={menuLabel}
        className="flex h-11 w-11 items-center justify-center"
      >
        <MenuIcon size={22} aria-hidden="true" />
      </button>

      <Dialog open={open} onClose={setOpen} transition className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-scrim transition-opacity duration-base ease-editorial data-closed:opacity-0"
        />

        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            // The panel carries no data-surface: it is the default ivory surface,
            // so every NavLink inside reads ink even while the header is overlay.
            className="flex h-full w-full flex-col bg-bg text-text transition duration-base ease-editorial data-closed:opacity-0 data-closed:-translate-x-4 rtl:data-closed:translate-x-4"
          >
            <DialogTitle className="sr-only">{menuLabel}</DialogTitle>

            <div className="flex h-(--header-h) shrink-0 items-center justify-between px-5">
              <BrandLogo variant="mark" height={36} />
              <button
                type="button"
                onClick={close}
                aria-label={closeLabel}
                className="-me-2.5 flex h-11 w-11 items-center justify-center"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={primaryLabel} className="flex flex-col gap-2 px-5 pt-10">
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className="entrance-fade-up"
                  style={
                    {
                      '--entrance-delay': `${LINK_STAGGER_OFFSET_MS + index * LINK_STAGGER_MS}ms`,
                    } as CSSProperties
                  }
                >
                  <NavLink href={item.href} onClick={close} typography="type-h2" className="py-2">
                    {item.label}
                  </NavLink>
                </div>
              ))}
            </nav>

            {/* The lower band: account, then language. The single gold hairline
                is the only gold in the panel (guideline §3.2). */}
            <div className="mt-auto px-5 pb-8">
              <div className="mb-6 h-px bg-brand" aria-hidden="true" />
              <div className="flex min-h-11 items-center">
                <NavLink href={accountItem.href} onClick={close}>
                  {accountLabel}
                </NavLink>
              </div>
              <div className="mt-2 flex min-h-11 items-center">
                <LocaleSwitcher {...localeSwitcher} />
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
