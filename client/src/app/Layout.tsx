import { useState, useMemo } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { Button } from '@heroui/react';
import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';
import { StartupPrompt } from '../features/pos';
import { useOffline } from '../shared/hooks/useOffline';
import { useTranslation } from '../shared/i18n/index';
import { useAuthStore } from '../features/auth';
import { useSettingsStore } from '../shared/store/settingsStore';
import { CommandPalette, useCommandRegistry, type CommandItem } from '../shared';
import {
  WifiOff,
  Languages,
  Moon,
  Sun,
  Menu,
  LayoutDashboard,
  ShoppingCart,
  History,
  Package,
  Vault,
  Truck,
  ClipboardList,
  Settings,
  Search,
} from 'lucide-react';

export default function Layout(): React.JSX.Element {
  const { isOnline, queueLength } = useOffline();
  const { t, locale } = useTranslation();
  const { user } = useAuthStore();
  const { toggleLocale, toggleTheme, theme } = useSettingsStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

  // Register core navigation commands
  const defaultCommands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [
      {
        id: 'nav-dashboard',
        title: t('nav.dashboard') || 'Dashboard',
        description: 'Go to overview dashboard',
        category: 'Navigation',
        icon: LayoutDashboard,
        onSelect: () => navigate({ to: '/' }),
      },
      {
        id: 'nav-pos',
        title: t('nav.pos') || 'Point of Sale (POS)',
        description: 'Open sales register till',
        category: 'Navigation',
        icon: ShoppingCart,
        onSelect: () => navigate({ to: '/pos' }),
      },
      {
        id: 'nav-sales',
        title: t('nav.sales') || 'Sales History',
        description: 'View orders and receipts',
        category: 'Navigation',
        icon: History,
        onSelect: () => navigate({ to: '/sales' }),
      },
      {
        id: 'nav-inventory',
        title: t('nav.inventory') || 'Inventory',
        description: 'Manage products and stock',
        category: 'Navigation',
        icon: Package,
        onSelect: () => navigate({ to: '/inventory' }),
      },
      {
        id: 'nav-register',
        title: t('nav.register') || 'Register & Cash Float',
        description: 'Cash drawer movements',
        category: 'Navigation',
        icon: Vault,
        onSelect: () => navigate({ to: '/register' }),
      },
      {
        id: 'nav-deliveries',
        title: t('nav.deliveries') || 'Deliveries',
        description: 'Track orders and shipments',
        category: 'Navigation',
        icon: Truck,
        onSelect: () => navigate({ to: '/deliveries' }),
      },
      {
        id: 'nav-purchase-orders',
        title: t('nav.purchaseOrders') || 'Purchase Orders',
        description: 'Vendor receiving and orders',
        category: 'Navigation',
        icon: ClipboardList,
        onSelect: () => navigate({ to: '/purchase-orders' }),
      },
      {
        id: 'nav-settings',
        title: t('nav.settings') || 'Settings',
        description: 'Store preferences and configuration',
        category: 'Navigation',
        icon: Settings,
        onSelect: () => navigate({ to: '/settings' }),
      },
      {
        id: 'action-toggle-theme',
        title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        description: 'Toggle UI color theme',
        category: 'Preferences',
        icon: theme === 'dark' ? Sun : Moon,
        onSelect: toggleTheme,
      },
      {
        id: 'action-toggle-locale',
        title: locale === 'ar' ? 'Switch to English (LTR)' : 'التبديل إلى العربية (RTL)',
        description: 'Toggle language and direction',
        category: 'Preferences',
        icon: Languages,
        onSelect: toggleLocale,
      },
    ];
    return cmds;
  }, [t, navigate, theme, toggleTheme, locale, toggleLocale]);

  useCommandRegistry(defaultCommands);

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
            {/* Quick Command Launcher Button */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette (Ctrl+K)"
              className="hidden sm:flex items-center gap-2 h-9 px-3 text-xs text-muted-foreground bg-muted/50 hover:bg-muted border border-border rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('common.search') || 'Search...'}</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border/80 rounded">
                ⌘K
              </kbd>
            </button>

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

      {/* Global Command Palette */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <StartupPrompt />
    </div>
  );
}
