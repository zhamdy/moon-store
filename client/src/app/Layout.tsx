import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Button } from '@heroui/react';
import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';
import { StartupPrompt } from '../features/pos';
import { useOffline } from '../shared/hooks/useOffline';
import { useTranslation } from '../shared/i18n/index';
import { useAuthStore } from '../features/auth';
import { useSettingsStore } from '../shared/store/settingsStore';
import { WifiOff, Languages, Moon, Sun, Menu } from 'lucide-react';

export default function Layout(): React.JSX.Element {
  const { isOnline, queueLength } = useOffline();
  const { t, locale } = useTranslation();
  const { user } = useAuthStore();
  const { toggleLocale, toggleTheme, theme } = useSettingsStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onOpenChange={setMobileOpen} />
      <main className="lg:ms-64 min-h-screen flex flex-col">
        {/* Top header bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="light"
              className="lg:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label={t('nav.openNav') || 'Open navigation'}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center border border-border">
                <span className="text-foreground text-xs font-semibold">
                  {user?.name?.[0] || 'U'}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-foreground leading-tight">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground">{user?.role}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              onClick={toggleLocale}
              className="h-9 w-9 text-muted-foreground hover:text-foreground border border-border"
              title={locale === 'ar' ? 'English' : 'عربي'}
              aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Languages className="h-4 w-4" />
            </Button>
            <Button
              isIconOnly
              variant="light"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground border border-border"
              title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
              aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <NotificationCenter />
          </div>
        </header>

        {/* Offline banner */}
        {!isOnline && (
          <div className="bg-warning/10 border-b border-warning/30 text-warning px-4 py-2 text-sm flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            {t('offline.offlineBanner')}
            {queueLength > 0 && ` ${t('offline.queuedForSync', { count: queueLength })}`}
          </div>
        )}

        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      <StartupPrompt />
    </div>
  );
}
