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
        muted: 'hsl(var(--muted-foreground))',
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
            focus: '#18181B',
          },
        },
      },
    }),
  ],
};

