'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ArrowRight, Globe, Minus, Plus, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { LocaleSwitcher, type LocaleSwitcherProps } from '../locale-switcher';
import type { NavItem } from '../navigation-items';

export interface MobileMenuProps {
  menuLabel: string;
  /** The close button's accessible name (`navigation.closeMenu`). */
  closeLabel: string;
  /** The close button's visible word (`navigation.close`). */
  closeText: string;
  primaryLabel: string;
  items: Array<NavItem & { label: string }>;
  localeSwitcher: LocaleSwitcherProps;
  /**
   * Server-rendered sections (`features/collections/components/header-panels.tsx`):
   * `shop` opens under Shop, `collections` under Collections (`null`: Collections is a
   * plain link), `featured` is the card under the list (`null`: none).
   */
  sections: { shop: ReactNode; collections: ReactNode | null; featured: ReactNode | null };
}

/** The sections an item opens, by key; an item without one is a link row. */
type SectionKey = 'shop' | 'collections';
const isSectionKey = (key: string): key is SectionKey => key === 'shop' || key === 'collections';

/**
 * The mobile menu (header direction B, 2026-09-26: "Menu B"). An Ivory sheet rather than
 * the Espresso page it replaces: the menu is where a phone shopper chooses a category, so
 * it is set in the commerce register. Shop opens in place on its categories (open by
 * default), Collections on the live collections, New In is a link row, the featured
 * collection sits under the list as one card, and the language switch is at the foot.
 *
 * Shop and Collections are native `<details>` disclosures: keyboard, screen-reader state
 * and the open/closed toggle are the browser's, with no state here. Headless UI's Dialog
 * owns the focus trap, Escape and focus restoration. Any link clicked inside the sheet
 * closes it, and so does a route change. Receives translated strings and server-rendered
 * sections as props, never the message catalogue (apps/storefront/CLAUDE.md).
 */
export function MobileMenu({
  menuLabel,
  closeLabel,
  closeText,
  primaryLabel,
  items,
  localeSwitcher,
  sections,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  const close = () => setOpen(false);

  const onSheetClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('a')) {
      close();
    }
  };

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
            onClick={onSheetClick}
            className="flex h-full w-full flex-col overflow-y-auto bg-bg text-text transition duration-base ease-sheet data-closed:opacity-0 data-closed:-translate-x-4 rtl:data-closed:translate-x-4"
          >
            <DialogTitle className="sr-only">{menuLabel}</DialogTitle>

            <div className="grid h-(--header-h) shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border px-(--page-gutter)">
              <button
                type="button"
                onClick={close}
                aria-label={closeLabel}
                className="type-ui -ms-2.5 flex h-(--size-tap) cursor-pointer items-center gap-2.5 justify-self-start px-2.5"
              >
                <X size={20} strokeWidth={1.5} aria-hidden="true" />
                <span aria-hidden="true">{closeText}</span>
              </button>
              <BrandLogo variant="mark" height={40} className="h-10 w-auto" />
              <span aria-hidden="true" />
            </div>

            <nav aria-label={primaryLabel} className="px-(--page-gutter) pt-2">
              {items.map((item) => {
                const section = isSectionKey(item.key) ? sections[item.key] : null;
                if (!section) {
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="type-page-title flex min-h-18 items-center justify-between border-b border-border"
                    >
                      {item.label}
                      <ArrowRight
                        aria-hidden="true"
                        size={20}
                        strokeWidth={1.5}
                        className="rtl:rotate-180"
                      />
                    </Link>
                  );
                }
                return (
                  <details
                    key={item.key}
                    open={item.key === 'shop'}
                    className="group border-b border-border"
                  >
                    <summary className="type-page-title flex min-h-18 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                      {item.label}
                      <Plus
                        aria-hidden="true"
                        size={20}
                        strokeWidth={1.5}
                        className="group-open:hidden"
                      />
                      <Minus
                        aria-hidden="true"
                        size={20}
                        strokeWidth={1.5}
                        className="hidden group-open:block"
                      />
                    </summary>
                    {section}
                  </details>
                );
              })}
            </nav>

            {sections.featured && (
              <div className="px-(--page-gutter) pt-6">{sections.featured}</div>
            )}

            <div className="mt-auto px-(--page-gutter) pt-8 pb-8">
              <div className="flex min-h-(--size-tap) items-center gap-3 border-t border-border pt-3">
                <Globe aria-hidden="true" size={18} strokeWidth={1.5} className="shrink-0" />
                <LocaleSwitcher {...localeSwitcher} />
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
