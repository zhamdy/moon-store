import { useEffect, type RefObject } from 'react';

/**
 * Keeps a combobox reachable in the accessibility tree while its listbox is open.
 *
 * #113. HeroUI's `usePopover` runs `ariaHideOutside([popover])` unconditionally
 * whenever a popover opens (`@heroui/popover` `use-popover.ts` — note that its own
 * `isNonModal` default of `true` is not consulted, and react-aria's equivalent
 * guards on it). Everything that does not contain the popover is then marked
 * `aria-hidden`, and for a combobox inside a modal that includes the wrapper the
 * dialog is portaled into — so the dialog, every field in it, and the very
 * combobox that owns the open listbox all leave the accessibility tree at the
 * moment a screen-reader user is choosing from it.
 *
 * Measured in Chromium: with the listbox open the combobox reports
 * `ignored: true, ignoredReasons: ['ariaHiddenSubtree']` through its ancestor, and
 * `getByRole('combobox', { name: /select customer/i })` stops matching. Its
 * `aria-label` is intact throughout — the name was never the problem, the element's
 * presence was.
 *
 * So drop the `aria-hidden` the popover put on this field's ancestors. Nothing is
 * restored on close: those attributes are not ours, `ariaHideOutside` removes them
 * again in its own cleanup, and putting one back after that cleanup has run would
 * hide the dialog for good.
 *
 * What stays hidden is what react-aria's own `useComboBox` hides — it calls
 * `ariaHideOutside([input, popover])`, so the *siblings* inside the dialog remain
 * out of the tree, which is the correct behaviour for an open listbox. Only the
 * over-broad ancestor hiding is undone.
 */
export function useExposedWhileListboxOpen(
  ref: RefObject<HTMLElement | null>,
  isListboxOpen: boolean
): void {
  useEffect(() => {
    if (!isListboxOpen) return;
    for (let node = ref.current?.parentElement; node; node = node.parentElement) {
      if (node.getAttribute('aria-hidden') === 'true') node.removeAttribute('aria-hidden');
    }
  }, [ref, isListboxOpen]);
}
