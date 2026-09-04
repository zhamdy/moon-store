import type { BuildOptions } from 'vite';

export const buildOptions: BuildOptions = {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-router': ['@tanstack/react-router'],
        'vendor-query': ['@tanstack/react-query', '@tanstack/react-table'],
        'vendor-charts': ['recharts'],
        'vendor-ui-hero': ['@heroui/react'],
        'vendor-motion': ['framer-motion'],
        'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
      },
    },
  },
};
