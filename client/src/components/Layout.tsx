import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';
import { useOffline } from '../hooks/useOffline';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { WifiOff, Languages, Moon, Sun } from 'lucide-react';

export default function Layout(): React.JSX.Element {
  const { isOnline, queueLength } = useOffline();
  const { t, locale } = useTranslation();
  const { user } = useAuthStore();
  const { toggleLocale, toggleTheme, theme } = useSettingsStore();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ms-64 min-h-screen pb-20 lg:pb-0">
        {/* Top header bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center">
              <span className="text-gold text-sm font-semibold">{user?.name?.[0] || 'U'}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground leading-tight">{user?.name}</p>
              <p className="text-[10px] text-muted font-data">{user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLocale}
              className="flex items-center justify-center h-9 w-9 rounded-md text-muted hover:text-foreground hover:bg-surface border border-border transition-colors"
              title={locale === 'ar' ? 'English' : 'عربي'}
            >
              <Languages className="h-4 w-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-md text-muted hover:text-foreground hover:bg-surface border border-border transition-colors"
              title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <NotificationCenter />
          </div>
        </header>
        {/* Offline banner */}
        {!isOnline && (
          <div className="bg-gold-dark/20 border-b border-gold-dark text-gold px-4 py-2 text-sm flex items-center gap-2 font-data">
            <WifiOff className="h-4 w-4" />
            {t('offline.offlineBanner')}
            {queueLength > 0 && ` ${t('offline.queuedForSync', { count: queueLength })}`}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
