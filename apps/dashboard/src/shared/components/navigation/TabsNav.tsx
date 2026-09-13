import React, { useRef, isValidElement, type ReactNode, type ComponentType } from 'react';
import { useDirection } from '../../hooks/useDirection';

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: string | boolean }> | ReactNode;
  disabled?: boolean;
}

export interface TabsNavProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underlined';
  ariaLabel?: string;
  className?: string;
}

export function TabsNav({
  tabs,
  activeTab,
  onChange,
  variant = 'underlined',
  ariaLabel = 'Navigation tabs',
  className = '',
}: TabsNavProps): React.JSX.Element {
  const tabListRef = useRef<HTMLDivElement>(null);
  const { isRtl } = useDirection();

  const handleKeyDown = (e: React.KeyboardEvent, _index: number) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    const currentIndex = enabledTabs.findIndex((t) => t.id === activeTab);
    if (currentIndex === -1) return;

    let nextIndex = -1;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = isRtl
        ? (currentIndex - 1 + enabledTabs.length) % enabledTabs.length
        : (currentIndex + 1) % enabledTabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = isRtl
        ? (currentIndex + 1) % enabledTabs.length
        : (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = enabledTabs.length - 1;
    }

    if (nextIndex !== -1) {
      const nextTab = enabledTabs[nextIndex];
      onChange(nextTab.id);

      // Focus the newly active tab button
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
      const targetBtn = Array.from(buttons || []).find(
        (btn) => btn.getAttribute('data-tab-id') === nextTab.id
      );
      targetBtn?.focus();
    }
  };

  const renderIcon = (icon: TabItem['icon']) => {
    if (!icon) return null;
    if (isValidElement(icon)) return icon;
    if (typeof icon === 'function' || typeof icon === 'object') {
      return React.createElement(
        icon as ComponentType<{ className?: string; 'aria-hidden'?: string | boolean }>,
        {
          className: 'h-4 w-4 flex-shrink-0',
          'aria-hidden': 'true',
        }
      );
    }
    return null;
  };

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1 overflow-x-auto ${
        variant === 'underlined' ? 'border-b border-border' : 'p-1 bg-muted/60 rounded-xl'
      } ${className}`}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            id={`tab-${tab.id}`}
            aria-controls={`tabpanel-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium transition-all whitespace-nowrap select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              variant === 'underlined'
                ? `relative border-b-2 -mb-px ${
                    isActive
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`
                : `rounded-lg ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`
            } ${tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {renderIcon(tab.icon)}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono font-normal ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TabsNav;
