'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { Toaster } from 'sonner';

export interface AppToasterProps {
  /** "Notifications": the region's name; the hotkey is appended here. */
  label: string;
  /** "Dismiss": each toast's close button. */
  closeLabel: string;
  dir: 'ltr' | 'rtl';
}

/** Sonner's default, spelled out so the region's name can state it. */
const HOTKEY = ['altKey', 'KeyT'];

const ICON = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const;

// On ink the default ink focus ring would vanish; the toast re-points it at its own text colour.
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring-color)';

/**
 * The storefront's one toaster (the seventeenth client boundary), mounted by the locale
 * layout as a direct child of `<body>`: Headless UI's dialogs make only the subtree that owns
 * them inert (the header for the drawer, `main` for the filter sheet), so toasts stay
 * operable while a dialog is open. Owner decisions 2026-09-15: bottom centre, an ink pill
 * (ink ground, light text, `rounded-media`). Sonner keeps positioning, stacking, swipe and
 * its own reduced-motion rule.
 */
export function AppToaster({ label, closeLabel, dir }: AppToasterProps) {
  return (
    <Toaster
      dir={dir}
      position="bottom-center"
      hotkey={HOTKEY}
      customAriaLabel={`${label} (Alt+T)`}
      visibleToasts={3}
      closeButton
      icons={{
        success: <CircleCheck {...ICON} />,
        info: <Info {...ICON} />,
        // Garnet fails contrast on ink, so the error icon sits on a small light badge.
        error: (
          <span className="flex rounded-full bg-surface p-0.5 text-error">
            <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
          </span>
        ),
        close: <X size={16} strokeWidth={1.5} aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: closeLabel,
        classNames: {
          toast:
            'flex w-(--width) items-center gap-3 rounded-media bg-action ps-5 text-on-action shadow-(--shadow-overlay) [--focus-ring-color:var(--color-on-action)]',
          icon: 'flex shrink-0 self-start pt-3.5',
          content: 'min-w-0 flex-1 py-3.5',
          title: 'type-small',
          actionButton: `type-small inline-flex min-h-11 shrink-0 cursor-pointer items-center px-1 font-medium text-on-action underline decoration-on-action/50 decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-on-action ${FOCUS}`,
          // Sonner renders the close button first; `order-last` puts it at the inline end.
          closeButton: `order-last me-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center self-start rounded-full text-on-action/70 transition-colors duration-fast ease-ui hover:text-on-action ${FOCUS}`,
        },
      }}
    />
  );
}
