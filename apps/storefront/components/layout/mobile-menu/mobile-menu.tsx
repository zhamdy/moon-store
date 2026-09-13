'use client';

import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { Menu as MenuIcon, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NavLink } from '../nav-link';
import { LocaleSwitcher } from '../locale-switcher';
import { accountItem, type NavItem } from '../navigation-items';

export interface MobileMenuProps {
  menuLabel: string;
  closeLabel: string;
  primaryLabel: string;
  accountLabel: string;
  items: Array<NavItem & { label: string }>;
}

/**
 * The only client boundary in the header besides AppProviders (R21/R22). Receives
 * translated strings as props rather than the message catalogue — see
 * apps/storefront/CLAUDE.md.
 */
export function MobileMenu({
  menuLabel,
  closeLabel,
  primaryLabel,
  accountLabel,
  items,
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
            className="flex h-full w-full flex-col bg-bg shadow-[var(--shadow-overlay)] transition duration-base ease-editorial data-closed:opacity-0 data-closed:-translate-x-4 rtl:data-closed:translate-x-4"
          >
            <DialogTitle className="sr-only">{menuLabel}</DialogTitle>

            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-5">
              <BrandLogo variant="mark" height={32} />
              <button
                type="button"
                onClick={close}
                aria-label={closeLabel}
                className="flex h-11 w-11 items-center justify-center"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={primaryLabel} className="flex flex-col gap-6 px-5 py-8">
              {items.map((item) => (
                <NavLink key={item.key} href={item.href} onClick={close} typography="type-h3">
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto border-t border-border px-5 py-6">
              <NavLink href={accountItem.href} onClick={close}>
                {accountLabel}
              </NavLink>
              <div className="mt-6">
                <LocaleSwitcher />
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
