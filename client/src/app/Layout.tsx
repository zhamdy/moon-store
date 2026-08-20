import { Outlet, useRouterState } from '@tanstack/react-router';
import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';
import { StartupPrompt } from '../features/pos';
import { useOffline } from '../shared/hooks/useOffline';
import { useTranslation } from '../shared/i18n/index';
import { useAuthStore } from '../features/auth';
import { useSettingsStore } from '../shared/store/settingsStore';
import { WifiOff, Languages, Moon, Sun, ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export default function Layout(): React.JSX.Element {
  const router = useRouterState();
  const isPos = router.location.pathname.startsWith('/pos');

  const { isOnline, queueLength } = useOffline();
  const { t, locale } = useTranslation();
  const { user } = useAuthStore();
  const { toggleLocale, toggleTheme, theme } = useSettingsStore();

  if (isPos) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Minimal POS Header */}
        <header className="sticky top-0 z-30 bg-surface border-b border-border px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-muted hover:text-foreground flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <span className="font-semibold text-primary">Point of Sale</span>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="text-destructive text-xs font-medium flex items-center gap-1 bg-destructive/10 px-2 py-1 rounded-md">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
            <div className="text-sm text-foreground">{user?.name}</div>
          </div>
        </header>
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
        <StartupPrompt />
      </div>
    );
  }

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
              aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Languages className="h-4 w-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-md text-muted hover:text-foreground hover:bg-surface border border-border transition-colors"
              title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
              aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
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
      <StartupPrompt />
    </div>
  );
}
