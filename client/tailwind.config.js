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
        display: ['Playfair Display', 'serif'],
        body: ['DM Sans', 'sans-serif'],
        data: ['DM Sans', 'sans-serif'],
        arabic: ['Noto Naskh Arabic', 'DM Sans', 'sans-serif'],
      },
      letterSpacing: {
        wider: '0.05em',
        widest: '0.1em',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
      boxShadow: {
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
          small: '0.25rem',
          medium: '0.375rem',
          large: '0.5rem',
        },
        boxShadow: {
          small: 'none',
          medium: 'none',
          large: 'none',
        },
      },
      themes: {
        dark: {
          colors: {
            primary: {
              DEFAULT: '#FFFFFF',
              foreground: '#000000',
            },
            focus: '#FFFFFF',
            background: '#0D0D0D',
          },
        },
        light: {
          colors: {
            primary: {
              DEFAULT: '#000000',
              foreground: '#FFFFFF',
            },
            focus: '#000000',
          },
        },
      },
    }),
  ],
};

