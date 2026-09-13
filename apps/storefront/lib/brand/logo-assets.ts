/**
 * Source of truth for the Moon Fashion logo derivatives in `public/brand/`.
 * Both files are lossless derivatives of `docs/design/brand/moon-fashion-logo-original.png`:
 * background removed to transparency and canvas trimmed to the artwork's bounds
 * (`mark` is additionally cropped above the wordmark). No redraw, recolour or new
 * composition. Swapping a file only needs its path and dimensions updated here.
 */
export const logoAssets = {
  logo: {
    src: '/brand/moon-fashion-logo.png',
    width: 1031,
    height: 749,
    alt: 'Moon Fashion',
  },
  mark: {
    src: '/brand/moon-fashion-mark.png',
    width: 544,
    height: 562,
    alt: 'Moon Fashion',
  },
} as const;

export type LogoVariant = keyof typeof logoAssets;
