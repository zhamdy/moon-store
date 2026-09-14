export type PaginationItem = number | 'gap';

const MAX_SLOTS = 7;

/**
 * Page links for the >=768px pagination row, at most 7 slots: first, last, and a
 * three-page window around the current page (kept three wide at either end, so page
 * 12 of 12 shows 10, 11, 12). A gap hiding a single page shows that page instead,
 * since an ellipsis there would take the same slot and say less.
 */
export function paginationWindow(current: number, total: number): PaginationItem[] {
  if (!Number.isInteger(total) || total < 1) return [];
  if (total <= MAX_SLOTS) return Array.from({ length: total }, (_, i) => i + 1);
  const page = Math.min(Math.max(Math.trunc(current) || 1, 1), total);

  const start = Math.min(Math.max(page - 1, 1), total - 2);
  const pages = new Set<number>([1, total, start, start + 1, start + 2]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (p - previous === 2) items.push(p - 1);
    else if (p - previous > 2) items.push('gap');
    items.push(p);
    previous = p;
  }
  return items;
}
