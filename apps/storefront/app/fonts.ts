import { Inter, Lora, Tajawal } from 'next/font/google';

// Latin display/body pair, active for the `en` locale: Lora (serif) for display
// and editorial headings, Inter for UI and body (user decision, 2026-09-13,
// replacing Bodoni Moda / Manrope).
export const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Arabic face, active for the `ar` locale: Tajawal for both display and body
// (user decision, 2026-09-13, replacing Noto Naskh Arabic / IBM Plex Sans
// Arabic). Not a variable font, so the weights are listed: 400/500 for UI and
// body, 300 for the light display cuts. Includes the `latin` subset so brand
// text and numerals on /ar don't fall back to a system font.
//
// preload: false — all families are called from this one module, so next/font
// preloads every face on every locale's render regardless of which variable
// class layout.tsx applies to <html> (confirmed in built HTML). en is the
// default locale, so the Latin pair keeps its default preload and the Arabic
// face opts out rather than the reverse.
export const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
  preload: false,
});
