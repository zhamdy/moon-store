import { heroui } from '@heroui/react';
import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        border: 'hsl(var(--border))',
        // `--muted` is the surface, `--muted-foreground` the text on it. This used to be
        // a single `muted` mapped at the *foreground* variable, which meant `bg-muted`
        // painted with a text colour and, worse, `text-muted-foreground` matched no token
        // at all -- 465 usages across 84 files emitting no CSS, so every muted label
        // silently inherited its parent's colour. That is how "Cart is empty" rendered
        // near-white on white (#54).
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        foreground: 'hsl(var(--foreground))',
        gold: {
          light: 'hsl(var(--gold-light))',
          DEFAULT: 'hsl(var(--gold))',
          dark: 'hsl(var(--gold-dark))',
        },
        blush: {
          light: '#F5D0DF',
          DEFAULT: '#E8B4C8',
        },
        destructive: 'hsl(var(--destructive))',
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        card: 'hsl(var(--card))',
        'card-border': 'hsl(var(--border))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        'table-header': 'hsl(var(--table-header))',
      },
      fontFamily: {
        sans: ['Tajawal', 'system-ui', 'sans-serif'],
        display: ['Tajawal', 'system-ui', 'sans-serif'],
        body: ['Tajawal', 'system-ui', 'sans-serif'],
        data: ['Tajawal', 'system-ui', 'sans-serif'],
        arabic: ['Tajawal', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        wider: '0.05em',
        widest: '0.1em',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        glow: 'none',
        'glow-strong': 'none',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    heroui({
      layout: {
        radius: {
          small: '0.375rem',
          medium: '0.5rem',
          large: '0.75rem',
        },
        borderWidth: {
          small: '1px',
          medium: '1px',
          large: '2px',
        },
      },
      themes: {
        dark: {
          colors: {
            primary: {
              DEFAULT: '#FAFAFA',
              foreground: '#18181B',
            },
            danger: {
              50: '#FEF2F2',
              100: '#FEE2E2',
              200: '#FECACA',
              300: '#FCA5A5',
              400: '#F87171',
              500: '#EF4444',
              600: '#DC2626',
              700: '#B91C1C',
              800: '#991B1B',
              900: '#7F1D1D',
              DEFAULT: '#EF4444',
              foreground: '#FFFFFF',
            },
            /**
             * Chosen against this theme's own background rather than inherited from
             * HeroUI's palette: the default success (#17C964) measures 2.19:1 on a light
             * surface, and the app never redefined it, so every `text-success` in a table
             * cell failed WCAG AA (#54). These are measured, not eyeballed --
             * #4ADE80 is 11.4:1 on #09090B, #FBBF24 is 11.9:1.
             */
            success: {
              DEFAULT: '#4ADE80',
              foreground: '#052E16',
            },
            warning: {
              DEFAULT: '#FBBF24',
              foreground: '#451A03',
            },
            focus: '#FAFAFA',
            background: '#09090B',
          },
        },
        light: {
          colors: {
            primary: {
              DEFAULT: '#18181B',
              foreground: '#FAFAFA',
            },
            danger: {
              50: '#FEF2F2',
              100: '#FEE2E2',
              200: '#FECACA',
              300: '#FCA5A5',
              400: '#F87171',
              500: '#EF4444',
              600: '#DC2626',
              700: '#B91C1C',
              800: '#991B1B',
              900: '#7F1D1D',
              DEFAULT: '#DC2626',
              foreground: '#FFFFFF',
            },
            // 5.02:1 and 5.02:1 on white respectively; the HeroUI defaults are 2.19:1.
            success: {
              DEFAULT: '#15803D',
              foreground: '#FFFFFF',
            },
            warning: {
              DEFAULT: '#B45309',
              foreground: '#FFFFFF',
            },
            focus: '#18181B',
          },
        },
      },
    }),
  ],
};

