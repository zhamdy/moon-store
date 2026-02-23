/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
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
        body: ['Cormorant Garamond', 'serif'],
        data: ['Inter', 'sans-serif'],
        arabic: ['Cairo', 'Inter', 'sans-serif'],
      },
      letterSpacing: {
        wider: '0.05em',
        widest: '0.1em',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
      boxShadow: {
        glow: '0 0 12px rgba(201, 169, 110, 0.2)',
        'glow-strong': '0 0 20px rgba(201, 169, 110, 0.3)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
