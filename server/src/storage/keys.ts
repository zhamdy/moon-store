import crypto from 'crypto';

/** Prefix every product image lives under, in every driver. */
export const PRODUCT_IMAGE_PREFIX = 'products';

const EXTENSION_FOR_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function extensionForContentType(contentType: string): string | null {
  return EXTENSION_FOR_TYPE[contentType] ?? null;
}

/**
 * Mints a key for a new product image.
 *
 * Same shape the old disk filenames used (`<millis>-<random><ext>`), so the resulting
 * public URL is indistinguishable from one written before this change. The name is derived
 * from the *detected* content type, never from the client-supplied filename.
 */
export function productImageKey(contentType: string): string {
  const ext = extensionForContentType(contentType);
  if (!ext) {
    throw new Error(`Unsupported image content type: ${contentType}`);
  }
  const suffix = crypto.randomBytes(4).toString('hex').slice(0, 6);
  return `${PRODUCT_IMAGE_PREFIX}/${Date.now()}-${suffix}${ext}`;
}
