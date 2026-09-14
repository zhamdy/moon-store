/** The server's cap (plan KD-8); a ninth upload is refused with GALLERY_FULL. */
export const GALLERY_MAX_IMAGES = 8;

/** Under `products` so any product invalidation also refreshes the gallery. */
export const galleryQueryKey = (productId: number) => ['products', productId, 'images'] as const;

/** The id list after moving one image a step; the reorder route takes the whole list. */
export function moveImageIds(ids: readonly number[], index: number, delta: -1 | 1): number[] {
  const target = index + delta;
  if (target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
