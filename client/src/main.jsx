import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { queryClient } from './lib/queryClient';
import { useSettingsStore } from './store/settingsStore';
import './index.css';

function ThemedToaster() {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: isDark ? '#141414' : '#FFFFFF',
          color: isDark ? '#F5F0E8' : '#1E1E1E',
          border: `1px solid ${isDark ? '#1E1E1E' : '#E0E0E0'}`,
          fontFamily: 'Inter, Cairo, sans-serif',
        },
        success: {
          iconTheme: { primary: '#C9A96E', secondary: isDark ? '#0D0D0D' : '#FFFFFF' },
        },
        error: {
          iconTheme: { primary: '#EF4444', secondary: isDark ? '#0D0D0D' : '#FFFFFF' },
        },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ThemedToaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
