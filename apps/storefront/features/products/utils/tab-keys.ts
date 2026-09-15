export type TabOrientation = 'horizontal' | 'vertical';

/**
 * The WAI-ARIA tabs keyboard model, with automatic activation. The reading-forward
 * arrow (Right in LTR, Left in RTL) goes to the next tab and the reading-back arrow to
 * the previous; a vertical tablist also takes Down and Up. Both wrap at the ends, as
 * the APG tabs pattern specifies; Home and End jump. Returns `null` for any other key,
 * so the caller leaves it alone.
 */
export function tabKeyTarget(
  key: string,
  index: number,
  count: number,
  dir: 'ltr' | 'rtl',
  orientation: TabOrientation
): number | null {
  if (count < 1) return null;
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  const vertical = orientation === 'vertical';

  if (key === forward || (vertical && key === 'ArrowDown')) return (index + 1) % count;
  if (key === back || (vertical && key === 'ArrowUp')) return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
