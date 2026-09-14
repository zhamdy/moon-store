'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { tabKeyTarget } from '../utils/tab-keys';

export interface ProductTabItem {
  id: string;
  /** Resolved on the server. */
  label: string;
  /** Whether the panel holds a focusable element; if not, the panel is a tab stop (APG). */
  panelHasFocusable: boolean;
}

export interface ProductTabsProps {
  tabs: ProductTabItem[];
  /** The tablist's accessible name. */
  label: string;
  dir: 'ltr' | 'rtl';
  /** Server-rendered panel content, keyed by tab id. */
  panels: Record<string, ReactNode>;
}

/**
 * The product details tabs (ED-4): a horizontal WAI-ARIA tablist with automatic
 * activation over server-rendered panels. The storefront's twelfth client boundary; it
 * owns only which tab is active. The server HTML shows the first tab, the rest `hidden`.
 * The bar is sticky (`[data-product-tabs-bar]` in `app/globals.css`).
 */
export function ProductTabs({ tabs, label, dir, panels }: ProductTabsProps) {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const [changed, setChanged] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  function select(index: number) {
    if (index === active) return;
    setActive(index);
    setChanged(true);
    // While the bar is stuck, a shorter panel could leave the reader below the section:
    // bring its top back under the header (`scroll-margin` there clears it).
    const section = root.current;
    const stuckBar = bar.current;
    if (
      section &&
      stuckBar &&
      section.getBoundingClientRect().top < stuckBar.getBoundingClientRect().top - 1
    ) {
      section.scrollIntoView({ block: 'start' });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = tabKeyTarget(event.key, active, tabs.length, dir, 'horizontal');
    if (target === null) return;
    event.preventDefault();
    select(target);
    buttons.current[target]?.focus();
  }

  return (
    <div ref={root} data-product-tabs>
      <div ref={bar} data-product-tabs-bar>
        <div role="tablist" aria-label={label} onKeyDown={onKeyDown}>
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={index === active}
              aria-controls={panelId(tab.id)}
              tabIndex={index === active ? 0 : -1}
              data-product-tab
              className="type-label"
              onClick={() => select(index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          id={panelId(tab.id)}
          role="tabpanel"
          aria-labelledby={tabId(tab.id)}
          hidden={index !== active}
          tabIndex={tab.panelHasFocusable ? undefined : 0}
          // Only a change fades; the first panel is server markup and never animates in.
          data-fade={changed && index === active ? '' : undefined}
          data-product-tabs-panel
          className="pt-8 md:pt-10"
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
