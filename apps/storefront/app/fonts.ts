import localFont from 'next/font/local';

// The Moon Fashion type system (design system 2026-09-25, superseding the 2026-09-13
// Lora / Inter / Tajawal decision): Instrument Serif for English display, Hanken Grotesk
// for English UI and body, Amiri for Arabic display, Tajawal for Arabic UI and body.
//
// Self-hosted with next/font/local (files in assets/fonts, SIL OFL, licences beside them)
// rather than next/font/google: the build no longer fetches from Google Fonts, and
// every face gets a metric-matched fallback so the swap does not shift layout.
//
// Subsets. The Latin faces carry the Latin subset only; the Arabic faces carry the Arabic
// subset only, with no Latin glyphs, so on /ar Latin letters and digits (prices, sizes,
// phone numbers) fall through the stack to Hanken Grotesk or Instrument Serif. Numerals
// therefore look the same in both locales. The stacks are assembled in app/globals.css
// (`--font-display-active` / `--font-body-active`).
//
// Fallbacks. The Latin faces keep next/font's generated size-adjusted fallback (Times New
// Roman / Arial metrics). The Arabic faces opt out (`adjustFontFallback: false`): their
// variable must end at the family name so the Latin face that follows it in the stack
// is reached for Latin glyphs, rather than a generated Arial fallback that covers all of them.
//
// Preload. `next/font` preloads every face declared in this module on every locale's
// render (see apps/storefront/CLAUDE.md). English is the default locale and Hanken /
// Instrument also render Latin text on /ar, so the two Latin families preload (~84 KB for
// both, italic included); the Arabic faces (Amiri is ~100 KB a weight) do not.

export const instrumentSerif = localFont({
  src: [
    { path: '../assets/fonts/instrument-serif-latin-400.woff2', weight: '400', style: 'normal' },
    {
      path: '../assets/fonts/instrument-serif-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-instrument-serif',
  display: 'swap',
  fallback: ['Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

export const hankenGrotesk = localFont({
  src: [
    { path: '../assets/fonts/hanken-grotesk-latin-400.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/hanken-grotesk-latin-500.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/hanken-grotesk-latin-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-hanken-grotesk',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

export const amiri = localFont({
  src: [
    { path: '../assets/fonts/amiri-arabic-400.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/amiri-arabic-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-amiri',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});

export const tajawal = localFont({
  src: [
    { path: '../assets/fonts/tajawal-arabic-400.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/tajawal-arabic-500.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/tajawal-arabic-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-tajawal',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
