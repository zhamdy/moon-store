import { Bodoni_Moda, Manrope, IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic } from 'next/font/google';

// Latin display/body pair, active for the `en` locale.
export const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
});

export const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

// Arabic display/body pair, active for the `ar` locale. Both include the `latin`
// subset so brand text and numerals on /ar don't fall back to a system font.
//
// "Noto Serif Arabic" (named in the original design guideline) was not available
// through any font source or tooling verified for this project — the installed
// next/font catalog, Google's own font metadata API, Fontsource and the notofonts
// GitHub org all came back with no match. Noto Naskh Arabic is the substitute: a
// traditional Arabic serif/calligraphic display style (user decision, 2026-09-13).
//
// preload: false on both — all four families are called from this one module, so
// next/font preloads every face on every locale's render regardless of which
// variable class layout.tsx applies to <html> (confirmed in built HTML: both /en
// and /ar preload all 8 files). en is the default locale, so the Latin pair keeps
// its default preload and the Arabic pair opts out rather than the reverse.
export const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ['arabic', 'latin'],
  variable: '--font-noto-naskh-arabic',
  display: 'swap',
  preload: false,
});

export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500'],
  variable: '--font-plex-arabic',
  display: 'swap',
  preload: false,
});
