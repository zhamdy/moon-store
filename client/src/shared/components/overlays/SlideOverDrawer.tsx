import React, { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDirection } from '../../hooks/useDirection';
import { useFormFieldIds } from '../../lib/idUtils';

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DrawerSize;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  isDismissable?: boolean;
  hideCloseButton?: boolean;
  className?: string;
}

const sizeClasses: Record<DrawerSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
  full: 'sm:max-w-full',
};

export function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  isDismissable = true,
  hideCloseButton = false,
  className = '',
}: SlideOverDrawerProps): React.JSX.Element | null {
  const ids = useFormFieldIds(undefined, 'drawer');
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const { isRtl } = useDirection();

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

      const timer = setTimeout(() => {
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus();
        } else if (drawerRef.current) {
          const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            drawerRef.current.focus();
          }
        }
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isDismissable) {
          e.stopPropagation();
          onClose();
          return;
        }

        // Focus Trap
        if (e.key === 'Tab' && drawerRef.current) {
          const focusable = Array.from(
            drawerRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
        if (
          previouslyFocusedElementRef.current &&
          typeof previouslyFocusedElementRef.current.focus === 'function'
        ) {
          previouslyFocusedElementRef.current.focus();
        }
      };
    }
  }, [isOpen, isDismissable, initialFocusRef, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && isDismissable) {
      onClose();
    }
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-stretch sm:flex-row bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
    >
      <div
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={title ? ids.labelId : undefined}
        aria-describedby={description ? ids.descriptionId : undefined}
        className={`relative w-full ${sizeClasses[size]} max-h-[85vh] sm:max-h-full sm:h-full bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden border-t sm:border-t-0 sm:border-s border-border animate-in ${
          isRtl ? 'sm:slide-in-from-left' : 'sm:slide-in-from-right'
        } slide-in-from-bottom duration-200 ${isRtl ? 'sm:ms-0 sm:me-auto' : 'sm:ms-auto sm:me-0'} ${className}`}
      >
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 flex-shrink-0">
            <div>
              {title && (
                <h2 id={ids.labelId} className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p id={ids.descriptionId} className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-border/60 bg-muted/20 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default SlideOverDrawer;
