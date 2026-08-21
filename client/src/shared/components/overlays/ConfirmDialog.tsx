import React, { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/index';
import { useFormFieldIds } from '../../lib/idUtils';

export type ConfirmColor = 'danger' | 'primary' | 'secondary' | 'success' | 'warning' | 'default';

export interface ConfirmDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: ConfirmColor;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

const colorIcons: Record<string, typeof AlertTriangle> = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const confirmButtonColorClasses: Record<ConfirmColor, string> = {
  danger:
    'bg-destructive hover:bg-destructive/90 text-destructive-foreground focus-visible:ring-destructive',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500',
  primary: 'bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:ring-primary',
  secondary:
    'bg-secondary hover:bg-secondary/90 text-secondary-foreground focus-visible:ring-secondary',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500',
  default: 'bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900',
};

export function ConfirmDialog({
  open,
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  confirmColor = 'danger',
  onConfirm,
  onCancel,
  isLoading = false,
  variant,
}: ConfirmDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const ids = useFormFieldIds(undefined, 'confirm-dialog');
  const modalOpen = isOpen !== undefined ? isOpen : (open ?? false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const activeVariant = variant || (confirmColor === 'danger' ? 'danger' : 'info');
  const IconComponent = colorIcons[activeVariant] || AlertTriangle;

  const handleClose = React.useCallback(() => {
    if (onCancel) onCancel();
    if (onOpenChange) onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const handleConfirm = React.useCallback(async () => {
    await onConfirm();
    if (onOpenChange) onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  useEffect(() => {
    if (modalOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isLoading) {
          e.stopPropagation();
          handleClose();
          return;
        }

        // Focus Trap
        if (e.key === 'Tab' && dialogRef.current) {
          const focusable = Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [modalOpen, isLoading, handleClose]);

  if (!modalOpen) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={ids.labelId}
        aria-describedby={description ? ids.descriptionId : undefined}
        className="relative w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
      >
        <div className="flex items-start gap-4">
          <div
            className={`pt-0.5 flex-shrink-0 ${
              confirmColor === 'danger'
                ? 'text-destructive'
                : confirmColor === 'warning'
                  ? 'text-amber-500'
                  : 'text-primary'
            }`}
          >
            <IconComponent className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="flex-1 space-y-1">
            <h2 id={ids.labelId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <div id={ids.descriptionId} className="text-sm text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isLoading}
            onClick={handleClose}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {cancelText || t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-50 flex items-center gap-1.5 ${confirmButtonColorClasses[confirmColor]}`}
          >
            {isLoading && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
