import { useEffect, useCallback } from 'react';

export interface PosShortcutActions {
  focusSearch: () => void;
  toggleScanner: () => void;
  openCheckout: () => void;
  clearCart: () => void;
  holdCart: () => void;
  incrementLastItem: () => void;
  decrementLastItem: () => void;
  removeLastItem: () => void;
  showHelp: () => void;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable
  );
}

export function usePosShortcuts(actions: PosShortcutActions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Always allow Escape regardless of focus
      if (e.key === 'Escape') {
        // Escape is handled natively by dialogs/sheets — only blur here
        if (isInputFocused()) {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      // Skip shortcuts when typing in an input
      if (isInputFocused()) return;

      // Prevent default for matched shortcuts
      switch (e.key) {
        case 'F1': {
          e.preventDefault();
          actions.focusSearch();
          break;
        }
        case 'F2': {
          e.preventDefault();
          actions.toggleScanner();
          break;
        }
        case 'F3': {
          e.preventDefault();
          actions.openCheckout();
          break;
        }
        case 'F4': {
          e.preventDefault();
          actions.clearCart();
          break;
        }
        case 'F5': {
          e.preventDefault();
          actions.holdCart();
          break;
        }
        case '?': {
          e.preventDefault();
          actions.showHelp();
          break;
        }
        case '+':
        case '=': {
          e.preventDefault();
          actions.incrementLastItem();
          break;
        }
        case '-': {
          e.preventDefault();
          actions.decrementLastItem();
          break;
        }
        case 'Delete': {
          e.preventDefault();
          actions.removeLastItem();
          break;
        }
        default:
          break;
      }
    },
    [actions]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
